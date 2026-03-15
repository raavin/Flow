# Integrations Framework Plan

## Context

The app has a complete commerce model (`commerce_orders`, `financial_transactions`, `place_order_from_cart()`) but payments are mocked (`payment_provider = 'mock'`), there's no way to connect real payment providers, no accounting sync, and no API surface for Shiftly (the sister staff scheduling app) to read or write data. There's a placeholder `integrations text[]` column on `profiles` that has never been used.

The goal is a framework that:
- Is secure by default (HMAC signatures, API key hashing, OAuth PKCE, vault-stored secrets)
- Uses patterns developers already trust (Stripe-style API keys, standard signed webhooks)
- Is extensible: adding a new provider means writing an adapter, not changing core tables
- Lives entirely inside the Supabase project — Deno edge functions + PostgreSQL triggers + vault

---

## Architecture Overview

Three layers:

```
PostgreSQL         → state, RLS, PL/pgSQL functions, triggers that enqueue events
Edge Functions     → untrusted inbound traffic (payment webhooks, OAuth callbacks, API requests)
React SPA          → integrations settings UI, OAuth popup flow, API key management
```

Three trust tiers:
1. **Supabase Auth JWT** — existing users via the SPA
2. **API keys** (`sa_live_<random>`) — Shiftly and external developers, prefix+SHA-256 hash stored
3. **Provider HMAC signatures** — inbound webhooks from Stripe/PayPal verified before any DB write

Secrets (OAuth tokens, BSB/account numbers, webhook signing keys) are **never stored in application tables**. They live in `vault.secrets` and are referenced by UUID. Only SECURITY DEFINER PL/pgSQL functions and edge functions using the service role key can read vault.

---

## Phase 1 — Database Foundation

### Migration: `supabase/migrations/20260316100000_integrations_foundation.sql` ✅

#### `connected_integrations` table
Tracks OAuth connections and provider credentials per profile.
```sql
create table public.connected_integrations (
  id                            uuid primary key default gen_random_uuid(),
  profile_id                    uuid not null references public.profiles(id) on delete cascade,
  provider                      text not null check (provider in (
                                  'stripe','paypal','openwallex','direct_banking',
                                  'xero','myob','shiftly','generic')),
  status                        text not null default 'active'
                                  check (status in ('active','disconnected','error','pending_oauth')),
  oauth_access_token_secret_id  uuid,   -- vault.secrets reference
  oauth_refresh_token_secret_id uuid,
  oauth_token_expires_at        timestamptz,
  oauth_scope                   text,
  provider_account_id           text,
  provider_account_label        text,
  metadata                      jsonb not null default '{}',
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now()),
  unique (profile_id, provider)
);
```
RLS: users can only read/modify their own rows.

Stripe Connect account ID stored as `metadata->>'stripe_account_id'` (no schema change needed for new providers — just metadata).

#### `integration_api_keys` table
Stripe-style prefix+hash. Raw key shown once at creation, never persisted.
```sql
create table public.integration_api_keys (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  name         text not null,
  key_prefix   text not null,      -- 'sa_live_'
  key_hash     text not null,      -- SHA-256 hex of full key
  scopes       text[] not null default '{}',
  last_used_at timestamptz,
  expires_at   timestamptz,
  is_active    boolean not null default true,
  created_at   timestamptz not null default timezone('utc', now())
);
```
RLS: own rows only.

#### `webhook_endpoints` table
Outbound webhooks — subscribers (Shiftly, third parties) register URLs here.
```sql
create table public.webhook_endpoints (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  url               text not null,
  description       text not null default '',
  event_types       text[] not null default '{}',  -- ['order.placed','order.paid'] or ['*']
  signing_secret_id uuid,  -- vault.secrets reference, signing key for outbound HMAC
  is_active         boolean not null default true,
  failure_count     integer not null default 0,
  last_success_at   timestamptz,
  last_failure_at   timestamptz,
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now())
);
```

#### `webhook_deliveries` table
Delivery log with retry state. Written only by edge functions (service role).
```sql
create table public.webhook_deliveries (
  id                   uuid primary key default gen_random_uuid(),
  endpoint_id          uuid not null references public.webhook_endpoints(id) on delete cascade,
  event_type           text not null,
  event_id             uuid not null default gen_random_uuid(),  -- idempotency key
  payload              jsonb not null,
  attempt_count        integer not null default 0,
  next_retry_at        timestamptz,
  status               text not null default 'pending'
                         check (status in ('pending','delivered','failed','abandoned')),
  last_response_status integer,
  last_response_body   text,
  created_at           timestamptz not null default timezone('utc', now()),
  delivered_at         timestamptz
);
create index idx_webhook_deliveries_pending on public.webhook_deliveries (next_retry_at)
  where status = 'pending';
```
RLS: profile can read deliveries for their own endpoints (subquery).

#### PL/pgSQL functions

**`public.create_integration_api_key(name, scopes, expires_at)`** — SECURITY DEFINER, generates `sa_live_<base64url(32 bytes)>`, stores SHA-256 hash, returns raw key once.

**`public.verify_integration_api_key(raw_key)`** — SECURITY DEFINER, hashes the raw key, returns `(profile_id, scopes, key_id)` if active and not expired, updates `last_used_at`.

**`public.store_oauth_tokens(provider, access_token, refresh_token, expires_at)`** — SECURITY DEFINER, calls `vault.create_secret()` for each token, updates `connected_integrations`. Browser never touches vault.

**`public.enqueue_order_webhook()`** — SECURITY DEFINER trigger function. On INSERT/UPDATE of `commerce_orders`, determines event type (`order.placed`, `order.paid`, `order.fulfilled`, `order.refunded`) from `TG_OP`/`NEW`/`OLD`, inserts rows into `webhook_deliveries` for all matching active endpoints for both `buyer_profile_id` and `seller_profile_id`.

**`public.enqueue_booking_webhook()`** — Same pattern for `calendar_events` → `booking.created`.

Trigger registration:
```sql
create trigger orders_webhook_fanout
  after insert or update of status on public.commerce_orders
  for each row execute function public.enqueue_order_webhook();

create trigger calendar_webhook_fanout
  after insert on public.calendar_events
  for each row execute function public.enqueue_booking_webhook();
```

#### Column addition: `financial_transactions`
```sql
alter table public.financial_transactions
  add column if not exists external_sync_ids jsonb not null default '{}';
-- e.g. { "xero": "<invoice_id>", "myob": "<entry_id>" }
```
Used by accounting sync to prevent duplicate journal entries.

---

## Phase 2 — Supabase Edge Functions (Deno v2)

All edge functions live under `supabase/functions/`. ✅

```
supabase/functions/
  _shared/
    auth.ts              ← verifyApiKey(), verifyJwt()
    hmac.ts              ← verifyHmacSha256(), signPayload()
    cors.ts              ← standard CORS response headers
    db.ts                ← createClient with service role
    providers/
      stripe.ts          ← normalise Stripe events → internal types
      paypal.ts          ← normalise PayPal events
      openwallex.ts      ← normalise OpenWallex events
      xero.ts            ← OAuth helpers, journal line builder
      myob.ts            ← OAuth helpers
  stripe-webhook/index.ts
  paypal-webhook/index.ts
  openwallex-webhook/index.ts
  oauth-connect/index.ts
  oauth-callback/index.ts
  dispatch-webhooks/index.ts
  create-payment-intent/index.ts
  xero-sync/index.ts
  myob-sync/index.ts
  api/
    v1/
      orders/index.ts    ← GET orders (Shiftly reads)
      schedules/index.ts ← GET calendar_events (Shiftly reads)
      shifts/index.ts    ← POST shift completions (Shiftly writes)
```

### `_shared/auth.ts`
- `verifyApiKey(req)` — Bearer `sa_live_...` → calls `rpc('verify_integration_api_key')` → returns `{ profileId, scopes, keyId }` or null
- `verifyJwt(req)` — Standard Supabase JWT verification

### `_shared/hmac.ts`
- `verifyHmacSha256(secret, payload, sig)` — constant-time comparison, accepts `sha256=<hex>` or raw hex
- `signHmacSha256(secret, payload)` — returns hex digest

### `stripe-webhook/index.ts`
1. Read raw body as `Uint8Array`
2. Parse `Stripe-Signature` header (format: `t=<ts>,v1=<hex>`)
3. Verify HMAC over `<timestamp>.<body>` using `STRIPE_WEBHOOK_SECRET` env var
4. Reject replays older than 5 minutes
5. On `payment_intent.succeeded`: UPDATE `commerce_orders` SET `payment_status='paid'`, `status='paid'`, `payment_reference=<pi_id>` WHERE `id = metadata.order_id`
6. On `charge.refunded`: UPDATE `payment_status='refunded'`, `status='refunded'`
7. On `account.updated` (Connect): UPDATE `connected_integrations.metadata`
8. Return `200 { received: true }` immediately

### `paypal-webhook/index.ts`
PayPal webhook verification calls PayPal's verification API (`POST /v1/notifications/verify-webhook-signature`). Updates orders on `PAYMENT.CAPTURE.COMPLETED` and `PAYMENT.CAPTURE.REFUNDED`.

### `oauth-connect/index.ts`
- GET `?provider=stripe|xero|myob|paypal`
- Verify Supabase JWT
- Generate PKCE: `code_verifier` (43 random base64url chars), `code_challenge = base64url(sha256(verifier))`
- Upsert `connected_integrations` with `status='pending_oauth'`, store `pkce_verifier` in `metadata`
- Return `{ url }` — SPA opens in a popup

### `oauth-callback/index.ts`
- GET `?code=...&state=<profile_id>:<provider>`
- Fetch `pkce_verifier` from pending row
- Exchange code at provider token endpoint with `code_verifier`
- Call `rpc('store_oauth_tokens', ...)` — vault write
- Remove `pkce_verifier` from metadata
- Redirect to `/app/integrations?provider=<name>&connected=1`

### `dispatch-webhooks/index.ts`
Scheduled every 30 seconds via pg_cron.
1. SELECT up to 50 deliveries WHERE `status='pending' AND next_retry_at <= now()`
2. Fetch endpoint URL + signing secret from vault
3. Sign payload with HMAC-SHA256
4. POST with headers: `X-Superapp-Event`, `X-Superapp-Delivery`, `X-Superapp-Signature-256`
5. On 2xx: `status='delivered'`
6. On failure: exponential backoff — 1m, 5m, 30m, 2h, 8h
7. After 6 attempts: `status='abandoned'`, increment `webhook_endpoints.failure_count`

### `create-payment-intent/index.ts`
Called by SPA at checkout when seller has Stripe connected.
1. Verify Supabase JWT
2. Load seller's `connected_integrations` for `stripe`, get `stripe_account_id` from metadata
3. Create Stripe PaymentIntent with `transfer_data.destination = stripe_account_id`, `metadata.order_id`
4. Return `{ client_secret, payment_intent_id }`

### `api/v1/orders/index.ts`
```
GET /functions/v1/api/v1/orders?since=<ISO>&status=placed
Auth: Bearer sa_live_...  (scope: orders:read)
Returns: commerce_orders WHERE seller_profile_id = caller_profile_id AND created_at > since
```

### `api/v1/schedules/index.ts`
```
GET /functions/v1/api/v1/schedules?from=<ISO>&to=<ISO>
Auth: Bearer sa_live_...  (scope: schedules:read)
Returns: calendar_events WHERE owner_id = caller_profile_id AND starts_at BETWEEN from AND to
```

### `api/v1/shifts/index.ts`
```
POST /functions/v1/api/v1/shifts
Auth: Bearer sa_live_...  (scope: shifts:write)
Body: { shiftly_shift_id, worker_profile_id, project_id, amount_cents, currency_code, completed_at, description }
Action: INSERT financial_transactions (source_kind='project', transaction_type='payout', direction='out')
Idempotency: deduped on reference_number = 'shiftly:<shiftly_shift_id>'
Returns: 201 { transaction_id }
```

---

## Phase 3 — Checkout Flow Update

### Migration: `supabase/migrations/20260316110000_link_order_payment.sql` ✅

```sql
create or replace function public.link_order_payment(
  p_order_id       uuid,
  p_provider       text,
  p_reference      text
) returns void language plpgsql security definer as $$
begin
  update public.commerce_orders
  set payment_provider = p_provider,
      payment_reference = p_reference
  where id = p_order_id
    and buyer_profile_id = auth.uid();
end;
$$;
```

### SPA changes (`apps/web/src/pages/tools.tsx` — `CartReviewPage`) ✅ (partial)
- Integration lib imported; `integrationsQuery` fetches connected integrations
- `sellerHasStripe` is a placeholder (false) — seller's Stripe status can't be queried from the SPA due to RLS; the `create-payment-intent` edge function enforces this server-side
- **Still to do:** Stripe.js wiring — call `create-payment-intent`, confirm with `stripe.confirmPayment()`, then `place_order_from_cart()` + `link_order_payment()`

---

## Phase 4 — Accounting Sync ✅

`xero-sync/index.ts` and `myob-sync/index.ts` — scheduled daily:
- Refresh OAuth token via provider token endpoint, store updated tokens back to vault
- Find `financial_transactions` WHERE `status='paid' AND external_sync_ids->>'xero' IS NULL`
- Map to Xero Invoice / MYOB General Journal entry
- POST to provider API
- UPDATE `external_sync_ids = jsonb_set(...)`
- On token failure: mark integration `status='error'`

---

## Phase 5 — UI ✅

### `apps/web/src/pages/integrations.tsx`
Route: `/app/integrations` — child of `appRoute`.

Four sections:
- **Payment Providers** — Stripe, PayPal, OpenWallex, Direct Banking. OAuth popup via `IntegrationConnectButton`.
- **Accounting** — Xero and MYOB with OAuth connect, last sync timestamp, "Sync now" button.
- **Shiftly** — Dedicated panel. API key management (pre-scoped to `orders:read, schedules:read, shifts:write`) + webhook endpoint form pre-populated with Shiftly events.
- **Developer API** — Generic API key table + webhook endpoint management with delivery log modal.

### `apps/web/src/components/integration-connect-button.tsx` ✅
Opens OAuth popup, polls `connected_integrations` via `useQuery` with 2s refetch interval until `active`.

### `apps/web/src/lib/integrations.ts` ✅
Full CRUD: `fetchConnectedIntegrations`, `createApiKey`, `revokeApiKey`, `fetchApiKeys`, `createWebhookEndpoint`, `updateWebhookEndpoint`, `deleteWebhookEndpoint`, `fetchWebhookEndpoints`, `fetchWebhookDeliveries`, `disconnectIntegration`.

### Types in `packages/types/src/index.ts` ✅
`IntegrationProvider`, `IntegrationStatus`, `ConnectedIntegration`, `IntegrationApiKey`, `WebhookEndpoint`, `WebhookDeliveryStatus`, `WebhookDelivery`

### Router + Nav ✅
- `integrationsRoute` registered in `apps/web/src/router.tsx`
- "Integrations" nav link added in `apps/web/src/components/layout.tsx` (Plug icon, all modes)

---

## Remaining Work

| Item | Notes |
|------|-------|
| Stripe.js checkout wiring | Call `create-payment-intent`, confirm with `stripe.confirmPayment()`, then `place_order_from_cart()` + `link_order_payment()`. Seller Stripe status checked server-side. |
| `pg_cron` schedules | `dispatch-webhooks` every 30s; `xero-sync` + `myob-sync` daily at 02:00 UTC |
| Unit tests | `hmac.ts` (sign/verify), `verify_integration_api_key()` (hash mismatch, expired key) |
| Playwright test | API key creation modal → copy → revoke flow |
| `exec_sql` RPC | The `pkce_verifier` cleanup in `oauth-callback` and `failure_count` increment in `dispatch-webhooks` use a placeholder `exec_sql` RPC. Add a proper migration or rewrite using direct SQL in a SECURITY DEFINER function. |

---

## Critical Files

| File | Why |
|------|-----|
| `supabase/migrations/20260314143000_commerce_orders_and_financials.sql` | `place_order_from_cart()` and the `payment_provider`/`payment_reference` columns that payment webhooks update |
| `apps/web/src/pages/tools.tsx` | `CartReviewPage` — where Stripe.js payment confirmation integrates |
| `apps/web/src/lib/wallet.ts` | `createWalletEntry()` — the shift completion API reuses this pattern |
| `packages/types/src/index.ts` | All integration types |
| `apps/web/src/router.tsx` | `integrationsRoute` registered |
| `apps/web/src/components/layout.tsx` | Nav item for Integrations |
| `supabase/config.toml` | Deno v2 confirmed active; edge function entries added |

---

## Security Summary

| Concern | Mechanism |
|---------|-----------|
| OAuth tokens | `vault.secrets` via SECURITY DEFINER RPC — never in application tables |
| BSB/account numbers | Same vault pattern, written only via edge function |
| API key storage | SHA-256 hex hash only; raw key shown once |
| API key format | `sa_live_<base64url(32)>` — enables secret scanning if repo goes public |
| Inbound webhook integrity | HMAC-SHA256 verified before any DB mutation (Stripe: local; PayPal: provider-side API call) |
| Outbound webhook integrity | Each delivery signed with per-endpoint HMAC key from vault |
| OAuth PKCE | `code_verifier` in metadata, deleted after token exchange |
| Edge function DB access | Service role client scoped by `profile_id` from `verify_integration_api_key()` — request body never trusted for identity |
