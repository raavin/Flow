# Money: budgets, allocations and costs

28 November 2026

## Purpose

Flow's money area supports the work people organise in conversations and projects. It is a private spending plan with cost, payment and receipt records. It does not hold money or process payments.

The previous implementation separated the project limit, allocation form and cost list into three panels. The overall screen was another summary with different columns. The new implementation uses one budget table and one calculation model at every level:

**Overall budget → optional project groups → projects → optional allocations → costs.**

A person can keep things simple with a project budget and a few costs. Groups and allocations add detail when needed; neither is mandatory.

## Research and design decisions

- [Xero's Budget Manager](https://central.xero.com/0/article/Create-a-budget) provides an overall worksheet, direct budget entry and comparison against actual results. Flow adopts direct amount editing and aligned financial columns, without charts of accounts, report configuration or accounting terminology.
- [Monarch group budgeting](https://help.monarch.com/hc/en-us/articles/18345219809940-Group-Budgeting) demonstrates how lower-level spending can roll up to a readable group total. Flow provides optional groups of projects and retains the ability to allocate within them. This is a Flow-specific hierarchy, not a reproduction of Monarch's budget modes.
- [YNAB's assignment workflow](https://support.ynab.com/en_us/assigning-your-money-a-guide-SypgkrNJi) distinguishes assigning money from spending it. Flow likewise separates **unallocated** money from **left after costs**. Flow's starting amount is manually entered; it is not a verified bank balance.
- A single level at a time avoids an ever-widening nested tree on phones. Breadcrumbs show where the user is. Main Money views use URL state so browser Back, reloads and links retain the selected level. The project budget uses the same table inside its existing project navigation.

These product patterns inform the design. Their suitability for Flow is a design judgement, not a claim that one app is a universal UX standard.

## Everyday workflow

1. Open **Money** and select **Set budget** in the Overall budget row. Existing project limits and costs remain in place; no funding amount is guessed.
2. Enter project budgets directly in the table. Optionally add a group such as Personal or Business, give it a budget, and select the projects it funds.
3. Open a project row. Its allocations and costs appear in the same table. Edit allocation amounts in place or choose **Add allocation**.
4. Open an allocation and choose **Add entry**. The project and allocation are already selected. The existing entry form supports estimates, actual amounts and a receipt photo or PDF.
5. Open a cost's **Details** to edit it, record a payment or upload receipts. Linked payments retain their own receipts in Activity. Use **Link to cost** for a separate payment that belongs to an existing cost.
6. Open **Project activity & receipts** or **Group activity & receipts** for the matching records. **View budget** returns to that same level. The all-activity link explicitly clears saved project filters.

The desktop menu and project navigation are unchanged. Financial tables stay tables. Amounts are right-aligned with tabular numerals; the name column stays visible while the table scrolls. Forms opened within a row stay within the visible panel width. Budget edits have Save/Cancel, error messages and keyboard focus restoration. Groups and allocations may be renamed; deleting a group keeps its projects and budgets. Only empty allocations can be removed, subject to existing quote links.

Activity's existing saved combinations of projects are now labelled **Saved views**. They still work and may overlap. Funding groups are different: a project has exactly one funding parent, so it cannot consume two groups' money accidentally.

## What the figures mean

| Figure | Meaning |
| --- | --- |
| Budget | Amount set aside at this level. Blank means unset; zero is an explicit zero budget. |
| Expected | Actual cost where recorded, otherwise estimate, never less than paid. Includes active separate AUD outgoing payments. |
| Paid | Settled payments plus costs recorded as paid. A linked payment contributes through its cost once. |
| Left after costs | Budget minus expected costs. An unset budget shows a dash rather than a misleading balance. |
| Unallocated / left to allocate | Budget minus reservations below this level. Reservations include child budgets and costs outside allocations. Oversubscribed child budgets carry upward, so an intermediate shortfall cannot hide commitments. |

Example with one group, one project, one allocation and a $650 cost with $200 paid:

| Level | Budget | Assigned below it | Unallocated | Expected | Paid | Left after costs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Overall | $10,000 | $6,000 | $4,000 | $650 | $200 | $9,350 |
| Personal group | $6,000 | $1,500 | $4,500 | $650 | $200 | $5,350 |
| Party project | $1,500 | $700 | $800 | $650 | $200 | $850 |
| Catering allocation | $700 | $650 | $50 | $650 | $200 | $50 |

The parent budget is not added to its child budgets. Expected and paid totals reconcile up the hierarchy. If the group's projects reserve $7,000 against its $6,000 budget, the group is marked overallocated and the overall budget reserves $7,000.

Income remains visible by currency and does not automatically increase the funding plan. Non-AUD records stay in Activity and are excluded from AUD spending totals. Cancelled/refunded transactions are excluded from active spending totals. The scope is explicitly all-time, matching project lifetimes rather than imposing a monthly household or accounting period. Separate payments need an explicit cost link if they represent an existing cost; Flow does not guess matches.

## Implementation and privacy

- `lib/budget-ledger.ts` builds the hierarchy and calculates all rollups. `components/budget-ledger.tsx` is shared by Money and project budgets. The superseded allocations-only component is removed.
- `money_budget_settings` stores the owner's optional overall amount. `budget_funds` stores private funding groups. A nullable `fund_id` on the existing private project limit assigns one parent.
- RLS limits the new tables to their owner. A composite owner/group foreign key prevents cross-owner project assignment. Existing project ownership checks still apply to project limit updates. Group deletion clears only the parent link, preserving project budgets and costs.
- The migration is additive and does not populate, modify or infer users' existing financial amounts. Public/shared project metadata never receives these financial fields. Existing receipt storage policies, payment reconciliation and quote security remain in force.

## Verification and limits

Coverage includes nested rollups, unset and zero budgets, overallocations, partial linked payments, separate payments, currencies, invalid amounts, retryable saves, group creation and project moves, allocation defaults, photo upload controls, URL navigation, browser Back, scoped activity and direct RLS tests with two users and an anonymous role. The route suite continues to cover all 48 app page URLs.

Validation: 199 tests passed, including the complete route suite; lint and the TypeScript/production build passed. The production build retains its existing large-bundle warning. The additive migration `20261127224058_integrated_budget_funds.sql` was applied to Flow’s connected Supabase project. Read-only checks confirmed owner-only RLS, denied anonymous access and a validated owner/group foreign key. The repository migration version matches the version recorded by Supabase.

The browser preview is unavailable in this workspace, so automated interaction checks use jsdom. These checks do not certify pixel layout or a real camera/upload session. Live visual review at narrow phone, tablet and desktop widths remains outstanding. No live user financial records were created for testing.
