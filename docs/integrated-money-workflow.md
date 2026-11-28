# Money: budget worksheet and cost records

28 November 2026

## Purpose and scope

Flow supports conversations that lead to projects. Its money tools help people set spending limits, allocate them, record costs and keep receipts. Flow does not hold money, move funds or provide a general ledger.

The previous revision connected the totals but left the allocation form above the table. That interrupted the task: users had to enter a line somewhere other than where it would appear. It also used Expected and Left after costs without clearly separating a recorded expense from its payment. This revision corrects both the entry workflow and the financial meaning of the columns.

One worksheet works at every level:

**Overall budget → optional project groups → projects → optional allocations → costs.**

Groups and allocations are optional. A project can have just a budget and a few costs. Existing amounts and global navigation are preserved.

## References and specific decisions

These are primary product documentation and design guidance, reviewed on 28 November 2026. The implementation is adapted to Flow; none of these sources prescribes Flow's exact hierarchy or screen.

| Reference | What it actually does | Decision for Flow |
| --- | --- | --- |
| [Xero: Budget Variance report](https://central.xero.com/0/article/Budget-Variance-report) | Compares budgeted revenue/expenses against actuals, with variance and reporting-period controls. | Use conventional Budget and Actual column names. Keep values aligned. Do not call paid cash Actual when a recorded cost is still unpaid. |
| [Xero: project expenses](https://central.xero.com/0/article/Add-an-expense-to-a-project) and [Xero Projects](https://central.xero.com/0/article/About-Xero-Projects) | Separates estimated expenses from actual expenses; actuals can be tracked against estimates. Its expense entry uses a form, including Save and add another. | Preserve the original estimate, record the eventual actual cost and avoid adding the two together. Repeated allocation entry keeps a fresh line open. Flow's inline row is our adaptation, not a claim about Xero's expense-entry layout. |
| [Intuit Enterprise Suite: project budgets](https://quickbooks.intuit.com/learn-support/en-us/help-article/manage-projects/manage-project-budgets-intuit-enterprise-suite/L313o8AOm_US_en_US) | Uses internal cost line items, budget-versus-actual tracking and a tracker with budget, actual cost and forecast. Availability depends on product/subscription. | Treat project costs as lines in a budget worksheet. Show Forecast separately from Actual so unpurchased items still contribute to planning. Avoid importing quantities, tax codes or invoicing controls until Flow needs them. |
| [Zoho Books: budgets](https://www.zoho.com/us/books/help/accountant/budgets.html) | Enters budget amounts beside account rows and compares budgets with actuals by period. | Edit the amount in the row it belongs to. Flow uses project/allocation names rather than asking casual users to understand a chart of accounts. |
| [business.gov.au: cash and accrual accounting](https://business.gov.au/finance/tax/choose-between-cash-and-accrual-accounting) | Distinguishes when money is paid from when a cost occurs. | A $500 recorded bill with $200 paid is a $500 actual cost and $300 unpaid. A $500 estimate is neither a bill nor $500 unpaid. This distinction does not make Flow a complete accrual accounting system. |
| [Nielsen Norman Group: data-table tasks](https://www.nngroup.com/articles/data-tables/) | Covers finding, comparing, adding/editing rows and acting on records; inline editing can preserve table context. | Add the editor at the bottom of the table, with inputs under the matching headings. Edit a cost in its existing row. Keep explicit Save/Cancel and preserve failed drafts. |
| [Carbon: data tables](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines) | Places secondary information in expanded rows and distinguishes table-wide from row-specific actions. | Put supplier, date, status, allocation and receipt controls immediately below the cost being edited. Keep the primary amount columns readable. |

Xero's report commonly uses **Budget / Actual / Variance**. Flow's planning worksheet uses **Budget / Actual / Forecast / Remaining** because projects also contain future estimates. Remaining is explicitly **Budget minus Forecast**, not the historical Budget-versus-Actual variance used in accounting reports.

The earlier revision also consulted Monarch's group budgeting and YNAB's assignment workflow. Those helped with hierarchy and allocation, but did not adequately determine the line-entry interaction. They are not the justification for this revision's financial column names.

## Entry and navigation

1. In Money → Budgets, edit the **Overall budget** amount in its row. It is a manually chosen spending limit, not a bank balance. Blank means unset; zero is an explicit zero limit.
2. Enter project budgets directly in their cells. To organise several projects, choose **+ Add group** at the bottom of the table. Enter the name under Description and its limit under Budget. Saving opens another blank group line; Cancel closes it.
3. Open a group and choose **+ Add project** at the bottom. Select an existing project in the new row; its existing budget and cost totals appear alongside it before adding. A project has one funding parent. Moving it preserves its budget and costs.
4. Open a project and choose **+ Add allocation** at the bottom of its table. Enter the name and amount in the matching columns. Save adds that line and leaves the next line ready, with keyboard focus in its name. Invalid amounts and failed saves leave the draft intact.
5. Choose **+ Add cost** in a project or allocation. The new cost's description, estimate and actual amount occupy the corresponding table cells. Forecast and Remaining preview the draft calculation. Supplier, date, status, allocation and photo/PDF receipt controls sit directly beneath this row. The current project and allocation are preselected.
6. Click a cost's budget amount or **Details → Edit** to replace that saved row with its editor. Existing group/allocation names and budgets can also be edited in their own total row. Financial writes still use the existing shared entry logic.
7. **Details** provides payments and receipts without leaving the worksheet. A linked payment settles the existing cost; it does not create another cost. **Activity & receipts** opens the corresponding project/group scope. Budget links return to that level. Browser Back and URL state preserve the selected level in Money.

The project Budget page embeds this same component. It does not require a second navigation scheme. Tables remain tables on phones, with contained horizontal scrolling and a sticky description column. Inputs use normal Tab/Shift+Tab and real HTML form association; this is not an Excel-style keyboard grid. Allocation/group drafts also support Escape to cancel. Actions are labelled, not icon-only.

Activity's existing overlapping project filters remain **Saved views**. They are not funding groups and cannot consume a budget a second time.

## Financial definitions

| Label | Definition |
| --- | --- |
| Budget | Spending limit for a group, project or allocation. On an individual cost, its original estimate is the line's budget baseline. |
| Actual | Recorded cost, including an unpaid bill. Estimates are excluded. An unknown actual on a cost line displays a dash, not a misleading zero. |
| Forecast | Actual cost where recorded, otherwise the estimate, never less than payments already recorded. Includes separate active outgoing AUD records once. |
| Remaining | Budget minus Forecast. A negative value is marked Over budget. An unset budget displays a dash. This is expected room in the spending plan, not cash available. |
| Paid | Settled payments and costs recorded as paid. A linked payment contributes through its cost once. |
| Unpaid | The unpaid portion of recorded costs: sum of max(Actual − Paid, 0) for each item. Estimates are excluded. Overpaying one item cannot conceal another item's unpaid bill. |
| Unallocated | Budget minus reservations for the lines beneath it. Reservations retain child budgets and original cost estimates, and carry overruns upward. It answers how much still needs assigning, rather than how much the final costs are expected to leave. |

Example: a project has a $1,000 budget and two direct cost lines.

| Description | Budget | Actual | Forecast | Remaining |
| --- | ---: | ---: | ---: | ---: |
| Project total | $1,000 | $500 | $800 | $200 |
| Catering | $600 | $500 | $500 | $100 |
| Flowers, still planned | $300 | — | $300 | $0 |

If $200 of catering has been paid, the project has **$200 paid and $300 unpaid**. It does not have $600 unpaid: the flowers are only planned. It has **$900 allocated and $100 unallocated** because the original catering budget remains $600 until the user changes it. The expected final headroom is $200, shown in Remaining. This distinction keeps a favourable actual cost from silently reallocating the user's original plan.

At each higher level, Actual, Forecast, Paid and Unpaid roll up from children. Parent budgets are never added to child budgets. An unset or undersized intermediate budget cannot hide lower-level reservations: a group budget of $6,000 with $7,000 allocated to projects reserves $7,000 at the overall level and is marked overallocated.

Income stays visible by currency and does not automatically increase a budget. Non-AUD records remain in Activity, outside these AUD totals. Cancelled/refunded transactions are excluded from active spending totals. Budgets are all-time, matching project lifetimes; Flow does not imply monthly, tax-period or general-ledger reporting. Separate payments require an explicit cost link; Flow does not guess matches.

## Implementation and privacy

- `lib/budget-ledger.ts` calculates the hierarchy, actuals, forecast, per-item unpaid balances and reservations using integer cents.
- `components/budget-ledger.tsx` renders the same worksheet in Money and project budgets. Creation actions and editors are table rows, not detached panels above the list.
- `components/budget-line-row.tsx` implements new/edit group and allocation rows with validation, repeat entry and retryable errors. Inputs use HTML `form` attributes because a form cannot wrap a table row.
- `components/money-entry-form.tsx` supports both its existing form layout and the cost-row layout with the same mutation and receipt logic. If the financial record saves but its receipt fails, retry uploads the receipt to that saved record instead of creating a duplicate.
- Existing private budget tables, project ownership checks, owner RLS, payment reconciliation, receipt storage policies and quote permissions are unchanged. No database migration or new production financial data is required for this revision.

## Verification and known limits

Regression coverage includes nested totals, original estimates versus actuals, partial linked payments, unknown actuals, completed zero-cost items, overpayments, currencies, zero/unset budgets and overallocations. Interaction coverage checks that allocation creation is in the table's last entry row, inputs belong to matching cells and a real form, save opens the next line, Escape closes it, failed writes preserve drafts and receipt retry does not duplicate a cost. Existing route and database-permission suites remain part of the complete check.

Validation for this revision: **205 tests across 30 files passed**, including all 48 page-route checks and database-permission tests. ESLint and the TypeScript/production build passed. The build retains the existing warning about a JavaScript bundle larger than 500 kB.

The schema represents an unknown actual cost as zero until it is recorded. A cost marked paid can have a known actual of zero. It does not yet have a separate flag for a final zero-valued unpaid cost. A partly paid item with no recorded final cost remains estimated; the worksheet does not invent a bill balance from that estimate.

Live browser preview is unavailable in this workspace. Automated interaction checks use jsdom and do not certify the visual layout, a real camera or a live file upload. Narrow-phone, tablet and desktop visual review remains outstanding. No live user financial records are created for testing.
