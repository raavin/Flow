# Flow: project budgets, receipts and supplier requests

## Goal

Keep conversations first. A project turns an idea into a plan; its budget and marketplace requests help people carry it out. No deposits, escrow, automatic charges or bank integration are introduced.

## Workflow

1. Set a project limit and allocate portions to named categories (venue, food, gifts, materials). Show unallocated funds and over-allocation explicitly.
2. Add estimated costs, assign them to allocations, record actual spend and attach private receipt images/PDFs to the saved cost. Attaching a receipt never changes the spend total; the user records the amount once.
3. From a project budget or Marketplace → Requests & quotes, publish a request. Choose an optional project/allocation, budget ceiling, desired date, broad location, requirements and a supplier-facing context note. Preview exactly what suppliers will see. Never automatically expose project messages, notes, participants, full budgets or receipts.
4. Suppliers browse open requests, submit an AUD quote with inclusions, availability and optional validity date, and can revise or withdraw before selection. Competing suppliers cannot see each other's quotes. Request owners see all quotes on their own request.
5. Each quote has a private discussion between its supplier and the requester. Selection keeps the discussion available for coordination; it does not grant project membership.
6. The requester confirms one quote. One database transaction locks the request, checks the quote, selects it, declines other pending quotes and creates one linked committed project cost if a project was selected. A repeated selection of the same quote returns the existing cost. It does not mark the expense paid.
7. Record actual spend and receipts in Budget when appropriate. Complete the request after delivery. Cancel an unassigned request if it is no longer needed. Historical quote terms remain available to the participants.

## Data and privacy

- Allocations and receipt records inherit project-owner privacy; they are not supplier-facing.
- Receipt files use a private `expense-receipts` bucket, JPEG/PNG/WebP/PDF only, maximum 10 MiB, user/expense/random-file paths, and short-lived signed links.
- Request and quote writes go through authenticated database functions with explicit ownership and state checks. Public request fields contain only the reviewed brief; a project UUID does not grant access to its contents.
- Quote messages are visible only to that quote's requester and supplier.
- Money values are integer AUD cents. Category allocations are planning limits, not account balances. Actual spend and quote commitments are not added twice.
- Existing marketplace templates/products/services stay available. Requests are a sibling marketplace section, with links back into the project budget.

## Release

Apply `supabase/migrations/20261126090000_budget_receipts_supplier_requests.sql` to the linked Supabase project before enabling the new screens in production. It creates the tables, policies, RPC functions and private storage bucket. Existing expenses need no backfill; allocation is optional. Existing theme, sharing and budget improvements are included in the same PR.

The repository SQL test runs the migration in PostgreSQL via PGlite with an isolated auth/storage test harness. It verifies requester/supplier/stranger access, allocation ownership, private receipt paths, quote selection and retry behaviour. It does not replace a production Storage upload smoke test or verify deployment credentials.

## References and design decisions

- Airtasker offer flow: https://support.airtasker.com/hc/en-au/articles/205056530-How-do-I-make-an-offer
- Airtasker offer revision/withdrawal: https://support.airtasker.com/hc/en-au/articles/201078720-How-can-I-change-or-withdraw-my-offer
- Supabase Storage policies: https://supabase.com/docs/guides/storage/security/access-control
- Supabase private buckets: https://supabase.com/docs/guides/storage/buckets/fundamentals

The offer/compare/select structure is adapted to Flow's project context. Payment handling is deliberately outside this feature. Shared context is a user-written snapshot rather than broad access to the underlying project.

### Deployment checks

1. Back up the linked database using the normal release process. Apply the migration through the Supabase SQL editor or the repository's authenticated Supabase CLI workflow (`supabase db push` after reviewing pending migrations).
2. Verify `expense-receipts` is private, limited to the four supported MIME types and 10 MiB. Existing budgets still load if the allocation column has not yet reached the API schema cache.
3. With two test accounts, publish a deliberately non-sensitive brief, submit and choose a quote, and confirm one committed expense with zero actual paid amount. A third account must not see either quote or discussion.
4. Attach, open and remove an image/PDF receipt. Confirm the supplier cannot read it and that the recorded spend changes only when edited in Budget.
5. Revisit signed-out Flow with a saved theme; create an undated plan and a media-only post. These regression fixes are included.

Known boundaries: AUD only; project-lifetime totals rather than monthly cash flow; no partial-payment ledger, receipt OCR, escrow, supplier verification or automated quote notifications. Selected quotes and costs retain links for history, so referenced costs cannot be deleted. Briefs are immutable after publication; cancel and replace an open request to revise it. Allocations can be renamed or resized. Templates continue through the existing marketplace flow.
