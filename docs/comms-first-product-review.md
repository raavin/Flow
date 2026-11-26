# Flow: conversations that become plans

## Product direction

Flow starts with communication: a public discussion, a private thought, a direct message, or a project conversation. People add structure when an idea is ready. A plan carries the preparation and follow-up around an event, not just its date. Reusable templates are a core product feature; AI can later help select and adapt them.

The feed remains the default after sign-in. Calendar, timeline, notes, budgets and marketplace are supporting views of the work emerging from those conversations.

## Implemented in this change

- Saved themes remain active before login (includes the preceding theme fix).
- Welcome copy explains the conversation-to-plan proposition; technical auth copy and the onboarding shortcut are removed. Mono secondary text has stronger contrast.
- Composer has explicit Only me / Followers / Everyone / Project members audiences and a private-note shortcut. Linking a message to a project preserves its audience. The plan action is clearer, and no longer pre-fills the target date from the old post's date.
- Project Notes and Budget are visible tabs. Budget limits, estimated and actual costs, and payment status are editable with validation and visible errors. New costs start unpaid. An explicitly paid zero-cost item remains zero in forecasts.
- Budgets provides an aggregate view across open projects or all projects. It shows allocated limits, forecast cost, paid cost and remaining cost to cover, plus per-project over-budget indicators. These are lifetime totals, not monthly cash-flow or an account balance.
- Money records describes recording payments made elsewhere and money owed. Pending entries no longer inflate the paid net total. IOUs start pending. Manual editing writes to the correct financial transaction columns, and manual settlement does not mark marketplace payments paid.
- Flows and templates are visible in navigation. Templates have a simple step editor, with the advanced JSON editor retained, and a full date preview before application. The parent range starts at the earliest preparation step, not just day zero.
- Starter plans include birthdays, wedding preparation, business launch, appointments and moving. Adding starters skips existing titles; it does not overwrite users' customisations. Existing birthday templates are not silently changed.
- Planning helper replaces the prototype AI screen with saved-template search, dated previews and optional attachment to an existing project. This is explicitly template-based. Existing AI action records remain intact; no external model integration was added.

## Page review and next priorities

| Surface | Assessment | Suggested next step |
| --- | --- | --- |
| Feed and composer | Best starting point for this product. The connection to plans is more valuable than adding more feed mechanics. | Add “plan together” to reply threads and DMs, retaining source attribution and explicit sharing choices. A conversation should remain readable after a plan is created. |
| Project conversation | Good context for decisions, people and updates. | Pin a small “next agreed action” summary with a responsible person and due date. Keep it secondary to the conversation. |
| Projects | Creation currently seeds generic Kickoff / Mid-point / Delivery milestones, with dates 30 and 60 days after the supplied target. This is poorly suited to birthdays and lightweight ideas. | Make blank projects truly lightweight; ask whether to use a template. Treat the target as an anchor, rather than adding arbitrary milestones beyond it. |
| Calendar and timeline | Already read timed coordination objects, so template steps can appear without separate calendar copies. | Introduce a reviewable “move the main date” operation that shifts flexible steps and flags fixed bookings. Never silently reschedule a confirmed supplier. |
| Templates | Coordination templates are owner-private; the marketplace has a separate template mechanism. The two concepts are not yet one sharing workflow. | Add versioned publish/copy controls, previews, attribution, and clearly optional steps. Start with free sharing, then optional commercial templates. |
| Budgets | A supporting planning layer is a better fit than a primary payments product. | Add due dates, committed costs versus money already paid, deposits/partial payments, category limits and a monthly view. Then add an optional overall household/work spending envelope. |
| Budget/payment linkage | Costs and transaction records currently have no reliable shared expense identifier. Adding both totals would double-count spending. | Introduce explicit reconciliation links and a “record against this cost” action before automatic totals. Preserve refunds, currencies and split payments correctly. |
| Money records | Detailed commerce columns are useful for sellers but heavy for everyday use. | Offer a simple list by default (what, who, amount, date, project, status), with tax, fees, references and seller net in expanded detail. Group summary totals by currency before supporting non-AUD planning. |
| Marketplace and jobs | Useful once a plan creates an actual need. They should not dominate personal navigation. | Let a project step become an opt-in request for quotes, with a chosen budget range and deadline. Suppliers see only the request, not private discussions or the full calendar. |
| Planning helper / AI | Saved plans now provide honest, useful functionality without pretending to be an AI assistant. | Add AI as draft assistance: select/adapt a template, propose missing steps and draft a reply. Show the proposed dates, costs and audience for review before any writes or outreach. |
| Availability and updates | Some existing logic still assumes Saturday/Sunday or a moving-house scenario. Timing-change previews can describe effects that are not fully executed. | Replace fixed examples with actual participant availability and a factual list of affected items. Distinguish a proposed shift from a completed reschedule. |
| Integrations and checkout | Existing provider and checkout flows are broader than the manual record screen. | Keep these as optional business capabilities. Clearly distinguish configured, demo and live states; do not treat a simulated checkout as a real payment. |
| Search and notifications | Cross-feature navigation is already present. | Bring plans and notes into plain-language search and offer a digest of things requiring a response, rather than increasing notification volume. |
| Mobile navigation | The app has substantial breadth and an icon rail on narrow screens. | Test five core journeys on a phone before adding navigation: reply, save a thought, start a plan, check the next step, record a cost. |

## Recommended build sequence

1. Complete the conversation-to-plan path across posts, reply threads and DMs, including ownership, attribution and participant permissions.
2. Unify template creation, sharing and date shifting; make blank project creation genuinely blank.
3. Add a small upcoming-actions surface alongside the feed, with user-selected pinning rather than replacing the social entry point.
4. Add budget due dates, partial payments and reconciliation; introduce an overall spending envelope once period and currency rules are explicit.
5. Pilot opt-in supplier quotes with one scenario, such as a party or event. Avoid unsolicited business bidding and automatic exposure of project details.
6. Add AI-assisted drafting only after the underlying objects and actions behave reliably.

## Verification limits and engineering follow-up

Automated tests cover theme persistence, currency parsing and budget forecasts, budget editing interactions with mocked services, manual ledger persistence and template date calculations. TypeScript and the production build are checked. These tests do not verify live Supabase permissions, writes or real provider payments.

The follow-up in `marketplace-budget-workflow.md` adds a database migration for private allocations/receipts and marketplace requests/quotes. No credentials, live accounts or payment-provider configuration are changed. Budget access retains the existing owner-only policies. The new aggregate screen does not introduce bank balances or a standalone global budget table.

Existing multi-write flows (project creation, template instantiation and activity recording) should move into transactional database functions with retry-safe operation identifiers. A downstream failure can currently leave partial results. Route-level code splitting should also be considered: the production application still loads a large JavaScript bundle.

## Implemented follow-up

Project category allocations, private receipt uploads, supplier-facing brief previews, private quotes/discussions and atomic quote selection are now implemented. See [the workflow and rollout plan](marketplace-budget-workflow.md). The remaining roadmap items above describe later improvements; supplier requests no longer depend on that roadmap. The new SQL tests execute the migration and policies in an isolated PostgreSQL harness; live Supabase Storage and authenticated production flows still require a deployment smoke test.
