-- =============================================================================
-- Integrations Foundation
-- Tables: connected_integrations, integration_api_keys, webhook_endpoints,
--         webhook_deliveries
-- Functions: create_integration_api_key, verify_integration_api_key,
--            store_oauth_tokens, enqueue_order_webhook, enqueue_booking_webhook
-- Triggers: orders_webhook_fanout, calendar_webhook_fanout
-- =============================================================================

-- Enable pgcrypto for gen_random_bytes, digest
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- connected_integrations
-- ---------------------------------------------------------------------------
create table public.connected_integrations (
  id                            uuid primary key default gen_random_uuid(),
  profile_id                    uuid not null references public.profiles(id) on delete cascade,
  provider                      text not null check (provider in (
                                  'stripe','paypal','openwallex','direct_banking',
                                  'xero','myob','shiftly','generic')),
  status                        text not null default 'active'
                                  check (status in ('active','disconnected','error','pending_oauth')),
  oauth_access_token_secret_id  uuid,
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

alter table public.connected_integrations enable row level security;

create policy "users_own_integrations"
  on public.connected_integrations
  for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- integration_api_keys
-- ---------------------------------------------------------------------------
create table public.integration_api_keys (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  name         text not null,
  key_prefix   text not null,
  key_hash     text not null,
  scopes       text[] not null default '{}',
  last_used_at timestamptz,
  expires_at   timestamptz,
  is_active    boolean not null default true,
  created_at   timestamptz not null default timezone('utc', now())
);

alter table public.integration_api_keys enable row level security;

create policy "users_own_api_keys"
  on public.integration_api_keys
  for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- webhook_endpoints
-- ---------------------------------------------------------------------------
create table public.webhook_endpoints (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  url               text not null,
  description       text not null default '',
  event_types       text[] not null default '{}',
  signing_secret_id uuid,
  is_active         boolean not null default true,
  failure_count     integer not null default 0,
  last_success_at   timestamptz,
  last_failure_at   timestamptz,
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now())
);

alter table public.webhook_endpoints enable row level security;

create policy "users_own_webhook_endpoints"
  on public.webhook_endpoints
  for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- webhook_deliveries
-- ---------------------------------------------------------------------------
create table public.webhook_deliveries (
  id                   uuid primary key default gen_random_uuid(),
  endpoint_id          uuid not null references public.webhook_endpoints(id) on delete cascade,
  event_type           text not null,
  event_id             uuid not null default gen_random_uuid(),
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

create index idx_webhook_deliveries_pending
  on public.webhook_deliveries (next_retry_at)
  where status = 'pending';

alter table public.webhook_deliveries enable row level security;

-- Users can read deliveries for their own endpoints
create policy "users_read_own_deliveries"
  on public.webhook_deliveries
  for select
  using (
    endpoint_id in (
      select id from public.webhook_endpoints where profile_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- financial_transactions — add external_sync_ids
-- ---------------------------------------------------------------------------
alter table public.financial_transactions
  add column if not exists external_sync_ids jsonb not null default '{}';

-- ---------------------------------------------------------------------------
-- create_integration_api_key
-- ---------------------------------------------------------------------------
create or replace function public.create_integration_api_key(
  p_name       text,
  p_scopes     text[],
  p_expires_at timestamptz default null
) returns text
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_profile_id uuid;
  v_raw_random bytea;
  v_raw_key    text;
  v_prefix     text;
  v_hash       text;
begin
  v_profile_id := auth.uid();
  if v_profile_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Generate 32 random bytes → base64url (strip padding)
  v_raw_random := gen_random_bytes(32);
  v_raw_key    := 'sa_live_' || replace(replace(encode(v_raw_random, 'base64'), '+', '-'), '/', '_');
  -- remove newlines and trailing =
  v_raw_key    := regexp_replace(v_raw_key, '[=\n]', '', 'g');
  v_prefix     := left(v_raw_key, 15); -- 'sa_live_' + 7 chars
  v_hash       := encode(digest(v_raw_key, 'sha256'), 'hex');

  insert into public.integration_api_keys
    (profile_id, name, key_prefix, key_hash, scopes, expires_at)
  values
    (v_profile_id, p_name, v_prefix, v_hash, coalesce(p_scopes, '{}'), p_expires_at);

  return v_raw_key;
end;
$$;

-- ---------------------------------------------------------------------------
-- verify_integration_api_key
-- ---------------------------------------------------------------------------
create type public.api_key_identity as (
  profile_id uuid,
  scopes     text[],
  key_id     uuid
);

create or replace function public.verify_integration_api_key(
  p_raw_key text
) returns public.api_key_identity
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_hash   text;
  v_row    public.integration_api_keys%rowtype;
  v_result public.api_key_identity;
begin
  v_hash := encode(digest(p_raw_key, 'sha256'), 'hex');

  select * into v_row
  from public.integration_api_keys
  where key_hash = v_hash
    and is_active = true
    and (expires_at is null or expires_at > now());

  if not found then
    return null;
  end if;

  -- Update last_used_at without raising on failure
  update public.integration_api_keys
  set last_used_at = now()
  where id = v_row.id;

  v_result.profile_id := v_row.profile_id;
  v_result.scopes     := v_row.scopes;
  v_result.key_id     := v_row.id;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- store_oauth_tokens
-- ---------------------------------------------------------------------------
create or replace function public.store_oauth_tokens(
  p_provider      text,
  p_access_token  text,
  p_refresh_token text default null,
  p_expires_at    timestamptz default null,
  p_scope         text default null,
  p_account_id    text default null,
  p_account_label text default null
) returns void
  language plpgsql
  security definer
  set search_path = public, vault
as $$
declare
  v_profile_id   uuid;
  v_access_id    uuid;
  v_refresh_id   uuid;
  v_existing_row public.connected_integrations%rowtype;
begin
  v_profile_id := auth.uid();
  if v_profile_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Fetch existing row to clean up old secrets
  select * into v_existing_row
  from public.connected_integrations
  where profile_id = v_profile_id and provider = p_provider;

  -- Store new access token in vault
  v_access_id := vault.create_secret(
    p_access_token,
    v_profile_id::text || '_' || p_provider || '_access',
    'OAuth access token for ' || p_provider
  );

  -- Store refresh token if provided
  if p_refresh_token is not null then
    v_refresh_id := vault.create_secret(
      p_refresh_token,
      v_profile_id::text || '_' || p_provider || '_refresh',
      'OAuth refresh token for ' || p_provider
    );
  end if;

  insert into public.connected_integrations (
    profile_id, provider, status,
    oauth_access_token_secret_id, oauth_refresh_token_secret_id,
    oauth_token_expires_at, oauth_scope,
    provider_account_id, provider_account_label,
    updated_at
  ) values (
    v_profile_id, p_provider, 'active',
    v_access_id, v_refresh_id,
    p_expires_at, p_scope,
    p_account_id, p_account_label,
    now()
  )
  on conflict (profile_id, provider) do update set
    status                        = 'active',
    oauth_access_token_secret_id  = v_access_id,
    oauth_refresh_token_secret_id = coalesce(v_refresh_id, connected_integrations.oauth_refresh_token_secret_id),
    oauth_token_expires_at        = p_expires_at,
    oauth_scope                   = coalesce(p_scope, connected_integrations.oauth_scope),
    provider_account_id           = coalesce(p_account_id, connected_integrations.provider_account_id),
    provider_account_label        = coalesce(p_account_label, connected_integrations.provider_account_label),
    updated_at                    = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- enqueue_order_webhook  (trigger function)
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_order_webhook()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_event_type text;
  v_endpoint   record;
  v_payload    jsonb;
begin
  -- Determine event type
  if TG_OP = 'INSERT' then
    v_event_type := 'order.placed';
  elsif NEW.status = 'paid' and (OLD.status is distinct from 'paid') then
    v_event_type := 'order.paid';
  elsif NEW.status = 'fulfilled' and (OLD.status is distinct from 'fulfilled') then
    v_event_type := 'order.fulfilled';
  elsif NEW.status = 'refunded' and (OLD.status is distinct from 'refunded') then
    v_event_type := 'order.refunded';
  else
    return NEW;
  end if;

  v_payload := jsonb_build_object(
    'event_type',  v_event_type,
    'occurred_at', timezone('utc', now()),
    'data', jsonb_build_object(
      'id',             NEW.id,
      'order_number',   NEW.order_number,
      'status',         NEW.status,
      'payment_status', NEW.payment_status,
      'total_cents',    NEW.total_cents,
      'currency_code',  NEW.currency_code,
      'buyer_profile_id',  NEW.buyer_profile_id,
      'seller_profile_id', NEW.seller_profile_id
    )
  );

  -- Fan out to all matching active endpoints for both buyer and seller
  for v_endpoint in
    select we.id
    from public.webhook_endpoints we
    where we.profile_id in (NEW.buyer_profile_id, NEW.seller_profile_id)
      and we.is_active = true
      and (
        we.event_types @> array['*']
        or we.event_types @> array[v_event_type]
      )
  loop
    insert into public.webhook_deliveries
      (endpoint_id, event_type, payload, next_retry_at)
    values
      (v_endpoint.id, v_event_type, v_payload, now());
  end loop;

  return NEW;
end;
$$;

create trigger orders_webhook_fanout
  after insert or update of status
  on public.commerce_orders
  for each row
  execute function public.enqueue_order_webhook();

-- ---------------------------------------------------------------------------
-- enqueue_booking_webhook  (trigger function)
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_booking_webhook()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_event_type text := 'booking.created';
  v_endpoint   record;
  v_payload    jsonb;
begin
  v_payload := jsonb_build_object(
    'event_type',  v_event_type,
    'occurred_at', timezone('utc', now()),
    'data', jsonb_build_object(
      'id',         NEW.id,
      'title',      NEW.title,
      'starts_at',  NEW.starts_at,
      'ends_at',    NEW.ends_at,
      'owner_id',   NEW.owner_id
    )
  );

  for v_endpoint in
    select we.id
    from public.webhook_endpoints we
    where we.profile_id = NEW.owner_id
      and we.is_active = true
      and (
        we.event_types @> array['*']
        or we.event_types @> array[v_event_type]
      )
  loop
    insert into public.webhook_deliveries
      (endpoint_id, event_type, payload, next_retry_at)
    values
      (v_endpoint.id, v_event_type, v_payload, now());
  end loop;

  return NEW;
end;
$$;

create trigger calendar_webhook_fanout
  after insert
  on public.calendar_events
  for each row
  execute function public.enqueue_booking_webhook();
