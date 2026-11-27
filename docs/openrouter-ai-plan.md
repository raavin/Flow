# OpenRouter AI implementation plan

Status: planned; this document does not enable AI or change the running app.

Updated: 28 November 2026. Repository baseline: `66911c4` on `main`.

## Purpose and product decisions

Flow remains a communications app that can turn discussions into useful plans and projects. AI is an optional aid to that transition, funded through each user's OpenRouter account. Someone using Flow for social conversation, manual planning or budgeting must have a complete experience without connecting AI.

The agreed decisions are:

- **Integrations is the home for AI setup.** Add OpenRouter to the existing `/app/integrations` page. Keep connection status, model choices, limits and usage together there. Settings may link to that section; it must not duplicate the controls or introduce another top-level AI destination.
- **Hide AI features until they are configured.** Without an active connection, everyday pages show no AI buttons, fields, model selectors, empty AI panels, disabled teasers or prompts to connect. OpenRouter setup remains discoverable in Integrations.
- **Keep manual features independent.** Receipt uploads, templates, project creation, task entry and ordinary expense forms work without AI. Existing templates at `/app/ai` remain usable regardless of that legacy route name.
- **AI has no extra authority.** Every operation must be something the signed-in user could perform manually, restricted further to the content, destination and action they selected.
- **Generated changes are drafts.** Users review and edit them before applying. AI cannot publish, spend money, invite people or change sharing permissions by itself.
- **Use plain labels and existing layouts.** Add small contextual actions; preserve navigation and the existing budget tables and expense forms.

## 1. Connection and interface behaviour

### Integrations → OpenRouter

The disconnected state contains a short explanation, **Connect OpenRouter**, and a note that generation uses the user's OpenRouter credits. After connecting, show connection status, model preferences by action, request/monthly limits, recent usage and **Disconnect**. Advanced manual key entry is optional later; secure account linking is the first release.

[OpenRouter's OAuth PKCE flow](https://openrouter.ai/docs/guides/overview/auth/oauth) returns a user-controlled API key. Its optional credit-limit and expiry parameters prefill choices the user can change; missing values can mean no limit or expiry. Treat those as provider-side preferences, not Flow's enforcement mechanism.

Proposed connection flow:

1. An authenticated POST starts a connection attempt. The server creates random, single-use state and an S256 PKCE verifier. Store the state hash, verifier secret reference, initiating user, connection generation and short expiry in a private pending-request record.
2. Redirect to OpenRouter using a fixed HTTPS callback URL from deployment configuration. Never accept an arbitrary callback URL from a request or model.
3. The Flow callback completes through an authenticated server endpoint. Require the same initiating user and unexpired, unused state before exchanging the code. A different or expired Flow session cannot finish the connection.
4. Exchange the code on the server. Store the credential encrypted in a restricted secret store, such as Supabase Vault after its access controls are audited. Return only safe connection metadata to the browser.
5. Consume the attempt once, clear temporary secrets, strip callback parameters from browser history and exclude callback query strings and provider response bodies from logs/analytics.

Keep credentials out of profile JSON, browser persistence, client bundles and model context. Never request an OpenRouter password or a management key. Access to one user's secret must not permit enumeration of another user's credentials.

Disconnect invalidates pending attempts and new generation requests, removes the stored credential and clears cached capability state. Check connection generation before accepting in-flight results so disconnect/reconnect races cannot restore an old connection. Explain that a request already sent may still be billed. Provide a direct revocation link to OpenRouter; do not claim local deletion revokes the provider key. Automatic revocation can be added only if the granted credential supports it.

### Visibility rules

Use one shared eligibility query/hook across all pages. It exposes safe booleans and capabilities, never credentials. Initially return no AI capability until the connection state is confirmed; avoid a flash of AI controls during loading or after an account switch.

| State | Everyday pages | Integrations |
| --- | --- | --- |
| Signed out, never connected or disconnected | Manual interface only; no AI affordances | Connection option when signed in |
| Connection loading or account switched | Hide AI controls until verified | Loading state |
| Connection pending, expired, revoked or invalid | Hide AI controls; keep manual forms intact | Finish connection or reconnect |
| Active connection, compatible model, permitted action | Show that action in its existing context | Preferences and usage |
| Active connection, but no compatible endpoint for an action | Hide that action; manual feature remains | Explain model compatibility |
| Active connection with a temporary outage or reached Flow limit | Keep manual work available; give a concise reason if an already configured action is unavailable | Status, usage and limits |

Clear account-specific query caches on sign-out and account changes. A disconnected user must not inherit another user's buttons, draft data or model preferences. Direct URLs and API calls must enforce the same setup and permission rules server-side; hiding controls is not an access control.

## 2. Initial actions and natural workflows

| Action | Entry point | Draft and review | Saving behaviour |
| --- | --- | --- | --- |
| **Suggest tasks** | Selected posts or messages | Task list with source references; edit, remove and select items | Add selected tasks to an explicitly chosen, authorised destination |
| **Draft plan** | A discussion, project or template | Steps, relative timing and dependencies, using an existing template when suitable | Preview dates, choose destination and apply through a checked transaction |
| **Read receipt** | Existing receipt/expense form | Merchant, date, currency, amount and suggested category beside the image | Fill editable fields; the normal Save action records the expense |
| **Draft request** | Supplier request form near the request list | Editable brief containing only selected project details | Save a draft; publishing remains the ordinary separate user action |

Only show these actions when the visibility rules above permit them. Do not create a second expense modal or hide receipt photo uploads behind an AI connection. Do not scan every post or run background classification merely because an account is connected.

The common interaction is select content, generate, review/edit, then apply. The preview identifies the destination, audience, proposed record count and any normal notifications or calendar effects. Keep the user's entered text and draft if generation fails. Return accessible status/error messages and preserve focus in existing dialogs.

For a birthday, for example, a user chooses the event date and a template; the model may suggest steps such as buying a present or arranging food. Flow computes calendar dates from validated offsets and the selected timezone. The preview can be edited and used without AI.

## 3. Permissions and containment

The server, database and storage policies enforce the boundary. A system prompt or a second AI model is not an authorisation mechanism. Supabase documents both [row-level security and the administrative roles that bypass it](https://supabase.com/docs/guides/database/postgres/row-level-security); the implementation must deliberately preserve the user's access context.

Required controls:

- Derive the actor from a verified Supabase session, never a body field, generated owner ID or model claim. Check current membership and role when reading sources, serving a saved draft and applying it.
- Bind each run to server-validated source IDs, one action, one destination and a bounded output size. A user who can edit two projects does not authorise the AI to edit both by selecting one.
- Use user-scoped database clients and existing domain permission checks for content reads and writes. Keep administrative secret/usage operations in narrow helpers that accept no arbitrary SQL, table names, target users or model-directed queries.
- Check access to individual receipts and financial records separately. Project membership must not reveal another member's private budget, expenses or receipt images.
- Confirm every supplied or generated reference belongs to the allowed scope. Resolve assignees only from eligible project members; missing or ambiguous assignments remain unassigned.
- Block automatic copying of private source material to a wider audience. A broader destination needs an explicit existing sharing flow; do not infer consent from generation or project selection.
- Treat posts, templates, supplier text, documents and image text as untrusted input. They cannot expand the selected scope or request credentials. This follows the separation of content and tool authority described by [OWASP's prompt-injection guidance](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html).
- Expose no shell, SQL, arbitrary HTTP, external plugin, database administration or generic execution tools to the model. Only application-defined draft schemas are accepted in the initial release.
- Do not allow model-directed deletion, ownership changes, invitations, permission changes, publication, quote acceptance, payments or use of other connected integrations.
- Render generated content with the same escaping and link restrictions as user content. Do not render generated HTML or load remote images from a draft; these can create script or data-exfiltration paths.

User-scoped RPCs should use invoker rights where practical. Any required definer function needs a fixed search path, limited grants and explicit checks of the authenticated actor, source access and destination permissions. An `owner_id` comparison alone does not establish all of these conditions.

A user may legitimately collaborate on someone else's project if their manual role allows it. AI must honour those existing rights, the selected scope and concurrent edits; it must not impose ownership-only rules that break normal collaboration.

## 4. Generation, validation and applying drafts

Define one versioned schema for each action and validate it independently on the server. Require bounded strings and arrays, known enumerations, valid references and no unexpected fields. Never accept generated SQL or arbitrary database patches.

For plans, check step count, dependency references, dependency cycles, date bounds and supported scheduling fields. Missing event dates or essential facts become questions or empty fields, not invented commitments. Scheduling uses Flow code and an explicit timezone, including daylight-saving changes.

For receipts, keep currency explicit and represent persisted money in the application's exact amount format, not unchecked floating-point calculations. Flag ambiguous dates, unclear digits and mismatched totals. Do not invent tax amounts or treat model confidence as evidence of correctness. Receipt extraction must not automatically mark an expense paid, accept a quote or change a budget allocation.

Structured output is useful but does not establish factual accuracy. OpenRouter describes [provider-specific schema support](https://openrouter.ai/docs/guides/features/structured-outputs); request the necessary parameters with `provider.require_parameters: true`, then still validate the response locally on the server.

Proposed run states: `queued`, `generating`, `needs_review`, `applied`, `failed`, `cancelled`, `expired`. Only server-controlled transitions can mark generation successful or a draft applied. User edits create a new draft revision and must be validated again.

Apply requirements:

1. Receive the draft ID, expected revision and a client-generated idempotency key; load the owner/scope from stored records.
2. Recheck the current session, source access, target rights and the exact draft revision. Check expected versions of records that would be updated, rather than overwriting a collaborator's changes.
3. Validate the edited payload and compute derived values again. Reject all-or-nothing if any proposed item fails.
4. Create the approved records and mark the draft applied in one transaction. Enforce a unique application per draft and an appropriately scoped idempotency key; retries return the original result.
5. Store a small audit record with actor, source references, model/provider, schema version and resulting record IDs. Trigger only the same side effects as the equivalent approved manual operation.

Limit an initial call to at most one repair attempt, within the original cost reservation. A timeout with an unknown billing outcome must not trigger a blind retry. Preserve a useful editable draft when safe; otherwise explain the error and leave project records unchanged.

## 5. Model choice and Jev

Offer a tested default per action, with an advanced selector for other technically compatible models. Distinguish **Recommended** from **Untested**; neither label changes permissions or validation. Show the reason when a selected model cannot perform an action, such as missing image support.

Maintain a server-side capability registry keyed by model and provider endpoint, covering required modality, structured output, context limits, privacy eligibility, prices and evaluation version. Refresh it and fail safely when a required capability or price cannot be established. Pin evaluated versions where available; a provider or model update must trigger re-evaluation rather than silently retaining a quality label.

Fallbacks must preserve the user's allowed models, privacy requirements and spending limits. Start with no cross-model fallback. Add user-controlled alternatives only after testing. Never silently substitute a more expensive or less private option.

[Jev](https://openrouter.ai/docs/guides/community/jev) can make typed decisions such as selecting a category or ranking suitable templates. Keep a decision-model adapter separate from generative planning; the current Decisions API uses `/api/alpha/decisions`, so isolate that changing API behind tests. Evaluate Jev later against simpler rules and existing models. Use labelled Flow examples to assess probability thresholds. Jev must not grant permissions, waive validation or certify financial correctness. An explicit user action already determines the module and needs no model router.

## 6. Spending and privacy

Use a dedicated user-funded connection. Do not silently charge a shared Flow key when the user's key fails. User-owned credits cover inference; Flow still has hosting, storage and operational costs.

Proposed limits and accounting:

- Store per-request and monthly Flow limits in USD to match provider billing; label currency clearly. If showing AUD estimates, also show the conversion date and avoid presenting them as the provider's final charge.
- Before sending, reserve a conservative maximum charge atomically against the user's remaining Flow budget. Include input, images, capped output/reasoning and the allowed repair attempt. If the endpoint's charge cannot be bounded, reject the run.
- Apply input/output limits, request timeouts, concurrency caps and rate limits. Provider price-per-token ceilings are additional controls, not total-request budgets; see [provider routing](https://openrouter.ai/docs/guides/routing/provider-selection).
- Reconcile provider-reported actual usage once per attempt. Keep uncertain charges reserved until resolved rather than incorrectly treating a timeout as free. Record the provider request ID for reconciliation.
- Define monthly reset boundaries server-side and display the next reset in the user's timezone. Lowering a limit cannot erase incurred charges or existing reservations.
- Show an estimate before generation and actual usage afterwards. Explain that Flow's ledger covers requests made through Flow, not spending from unrelated applications on the same OpenRouter account.

For privacy, send the smallest selected source set. The generation review identifies what will be sent and the receiving model/provider. Organisation restrictions on external processing override a member's personal connection. Never fetch arbitrary attachment URLs supplied by a model; read authorised private storage objects and send only the required bytes.

Receipt processing validates file type, dimensions and size. Use a derived, metadata-stripped image when appropriate while retaining the original receipt privately as evidence. Do not make the storage bucket public or share a permanent download URL. PDF extraction or format conversion needs its own constrained parser and limits before support is advertised.

Enforce the chosen provider data policy without silently relaxing it. OpenRouter's [ZDR documentation](https://openrouter.ai/docs/guides/features/zdr) distinguishes ZDR from Safety Retention, and `zdr: true` can follow an account setting that permits both. Private project and receipt processing should require verified ZDR-only eligibility; otherwise stop with a clear explanation. Do not promise that external processing has no exceptions or that data remains inside Flow.

Do not log raw prompts, generated private content, receipts or credentials for routine telemetry. Proposed initial retention: private drafts expire after 30 days unless applied; sanitised run/cost metadata is kept for 90 days, with only the minimum ledger retained for unresolved charges. Confirm deployment retention, backups and deletion behaviour before release. Remove inaccessible derived drafts when source permissions are revoked; keep any necessary accounting record free of private source content.

## 7. Repository changes and data design

These are proposed implementation locations, not completed features.

| Existing area | Proposed work |
| --- | --- |
| [`pages/integrations.tsx`](../apps/web/src/pages/integrations.tsx) | OpenRouter connection and preferences in the existing Integrations page |
| [`pages/tools.tsx`](../apps/web/src/pages/tools.tsx) | Optional Settings link to the OpenRouter section; no duplicate AI settings |
| [`integration-connect-button.tsx`](../apps/web/src/components/integration-connect-button.tsx) | Reuse visual behaviour after reviewing authenticated completion and mobile redirects |
| [`_shared/auth.ts`](../supabase/functions/_shared/auth.ts) | Reuse verified identity; add a clearly separated user-scoped data client |
| [`_shared/db.ts`](../supabase/functions/_shared/db.ts) | Keep the service-role client out of AI-directed content operations |
| [`oauth-connect`](../supabase/functions/oauth-connect/index.ts), [`oauth-callback`](../supabase/functions/oauth-callback/index.ts) | Do not copy the current predictable `profileId:provider` state or verifier-in-metadata design. Implement private single-use attempts and checked completion first |
| [`lib/ai.ts`](../apps/web/src/lib/ai.ts) | Replace/retire the canned keyword suggestions. Do not reuse acceptance that updates status before creating a task/event |
| [`apply-template.ts`](../apps/web/src/lib/apply-template.ts), [`template-planning.ts`](../apps/web/src/lib/template-planning.ts), [`apply-template-dialog.tsx`](../apps/web/src/components/apply-template-dialog.tsx), [`template-preview.tsx`](../apps/web/src/components/template-preview.tsx) | Reuse scheduling and preview pieces; audit/extend the transaction for generated drafts without publishing a template |
| [`receipt-picker.tsx`](../apps/web/src/components/receipt-picker.tsx), [`expense-receipts.tsx`](../apps/web/src/components/expense-receipts.tsx) | Keep upload available to everyone; add eligible extraction to the existing receipt flow |
| [`supplier-requests.tsx`](../apps/web/src/pages/supplier-requests.tsx) | Add eligible brief drafting inside the existing request form |
| [`packages/types/src/index.ts`](../packages/types/src/index.ts) | Action contracts and safe response types, shared with runtime validators |
| [`supabase/migrations`](../supabase/migrations) | Versioned migrations with explicit grants, RLS, constrained RPCs and indexes |

The existing [integrations plan](integrations-plan.md) is background, not a security sign-off. Its provider allowlist does not include OpenRouter, and its generic token/callback assumptions differ from the OpenRouter key flow. Prefer a dedicated OpenRouter adapter and small AI tables; share existing foundations only after review. This plan does not authorise adding payment processing.

Proposed records:

| Record | Contents and access |
| --- | --- |
| `ai_connections` | Safe connection status, provider, owner and credential generation. Owner can read; connection changes go through checked server operations |
| Private credential records | Owner-to-secret mapping accessible only to the credential broker; never expose the secret reference as a client-editable association |
| Private OAuth attempts | State hash, protected verifier, initiating user, expiry and consumed state; no client reads or arbitrary updates |
| `ai_preferences` | Per-action model preferences and spending limits; owner only, with server validation |
| `ai_runs` and private usage ledger | Action/scope references, versions, status, costs and reservations. User sees only safe own-account history; cannot forge status or usage |
| `ai_drafts` | Owner, source references, target, schema version, validated payload, revision, expiry and application IDs. Access also checks current rights to the underlying private sources |

Proposed authenticated endpoints are `ai-connect`, `ai-complete-connection`, `ai-disconnect` and `ai-generate`, with a narrow `apply_ai_draft` RPC. Final names can follow repository conventions. Browser-supplied preferences are requests, not authority. Server-derived actor, source selection, target checks, model eligibility and limits apply on every call. Do not store user session refresh tokens or introduce an autonomous background agent for these initial actions.

## 8. Delivery sequence

| Phase | Deliverables | Completion condition |
| --- | --- | --- |
| 0. Contracts and security baseline | Action schemas, current permission matrix, evaluation fixtures, threat cases and migration design | Existing manual rights and private-financial boundaries are covered by tests |
| 1. Connection and visibility | OpenRouter in Integrations, PKCE completion, secret lifecycle, preferences, capability query and server checks | Connect/reconnect/disconnect work; disconnected users see no AI controls on everyday pages |
| 2. Discussion to plan | Suggest tasks and Draft plan, existing preview, source links, spending ledger and atomic apply | Approved drafts create exactly the reviewed records; failure changes nothing |
| 3. Receipt extraction | Read receipt in the existing form, original image comparison, currency/date handling | Upload works without AI; extracted values are editable and never saved automatically |
| 4. Supplier briefs and optional decisions | Draft request, evaluated Jev adapter if it improves results/cost | No automatic publication or financial commitment; measured benefit from any extra model call |

Use feature flags for connection, each action and each tested model/provider pairing. Deploy schema and server enforcement before UI controls. Roll out to a small opt-in group, then expand only when the release checks pass. A kill switch stops new generation while manual features remain available. Rollback disables actions without deleting receipts, tasks, templates or applied plans.

## 9. Release checks

| Area | Required evidence |
| --- | --- |
| Setup visibility | Disconnected/loading/expired/revoked states show no AI controls across feed, discussions, projects, templates, budgets, expenses and supplier requests; Integrations remains the setup location |
| Account switching | No cached controls, drafts, costs or model preferences survive into another user's session |
| Manual use | Templates, social posting, receipt photo upload, expenses and project planning work with AI disabled |
| Connection security | Wrong/missing/replayed/expired state, wrong user, invalid verifier, simultaneous attempts and disconnect races cannot link or restore a credential |
| Secrets | Browser/network responses, logs, client builds and exposed database roles cannot retrieve credentials or verifiers |
| Cross-user access | Forged source IDs, draft IDs, target IDs, storage paths and owner fields cannot read or modify another user's unauthorised data |
| Collaborative access | Owners, editors, read-only members and removed members get exactly their manual rights, including after a draft was generated |
| Scope and privacy | A run cannot escape its selected project, expose a member's private finances or copy private content to a wider audience implicitly |
| Malicious content | Instructions embedded in posts, templates, supplier text and receipt images cannot invoke tools, obtain credentials or override scope |
| Apply integrity | Repeated clicks, retries, altered drafts, stale versions and partial failures cause no duplicates or partial commits |
| Financial data | AUD and other supported currencies, ambiguous dates, unreadable receipts, totals, refunds and duplicates are handled without inventing values |
| Cost enforcement | Concurrent calls, repair attempts, timeouts, uncertain usage, changed limits and month boundaries cannot bypass reservations |
| Model/provider failure | Invalid JSON, schema mismatch, refusal, missing capabilities, changed pricing and privacy-ineligible fallbacks fail safely |
| Interface quality | Mobile/desktop review, keyboard and screen-reader use, theme persistence and existing navigation pass visual checks |

Use synthetic or explicitly consented fixtures: birthdays, parties, a small business launch, discussion-derived tasks and representative receipts. Evaluate each model/provider combination on schema validity, unsupported claims, schedule correctness, expense-field accuracy, edit effort, latency and cost per accepted result. Record dataset and prompt versions. Establish numerical quality thresholds from a manually reviewed baseline before assigning Recommended status; security and permission checks have no tolerated failures.

Run the repository's appropriate tests, lint, typecheck and build for implementation changes, plus database/RLS and edge-function tests. This documentation-only change requires link and diff checks, not a claim that the planned runtime security tests have already passed.

## 10. Decisions to confirm during implementation

- Which models/providers qualify as Recommended, based on the evaluation results and current endpoint/privacy support.
- Initial request/monthly limit defaults and the exact retention settings supported by the deployment.
- Whether provider-key revocation is available under the user's granted credential; otherwise retain explicit OpenRouter revocation instructions.
- Whether draft dependencies need additional domain support beyond existing template scheduling. Do not advertise unsupported scheduling fields.
- Whether any PDF or HEIC conversion is needed for receipt extraction and can be supported safely within resource limits.

None of these decisions change the agreed location in Integrations, hidden AI controls until configured, or the user's permission boundary.
