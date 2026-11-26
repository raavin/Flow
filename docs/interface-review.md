# Flow interface review — 26 November 2026

## What changed

| Area | Finding | Change |
| --- | --- | --- |
| Main navigation | Budgets and Money records competed for attention. | One Money entry; local Budgets and Payments & IOUs views. Existing URLs and links still work. |
| Schedule | Calendar and Timeline were sidebar destinations plus repeated page shortcuts. | One Calendar entry, with Calendar/Timeline links above both views. Project-specific views remain inside their project. |
| Calendar | The empty creation form permanently consumed screen width. | Show the calendar at full width; New event opens and focuses the editor. Opening an existing event still loads its editor. |
| Timeline | “Interactive Gantt”, “Coordination mode” and “Strategic” required interpretation. | Timeline, Plans & events, Project tasks; one labelled scale selector with actual day intervals. The range includes today, so Today still works when every saved item is in the past or future. Date-only values use the local calendar date instead of converting local midnight to UTC. |
| Plans | “Internal kind” exposed implementation details alongside a second type selector. | One Type selector derives the stored kind; shorter labels and instructions. Template helper moves into Plans. |
| Payments | Fourteen columns required horizontal scrolling before any record was entered. | Six columns initially; Show accounting details reveals tax, fees, references and other fields. Data and editing remain intact. |
| Receipts | Photo upload existed but camera capture was not explicit. | Separate Choose image or PDF and Take photo controls. Camera support depends on the device/browser. JPEG, PNG, WebP and PDF remain supported, up to 10 MiB. |
| Copy | Repeated headings and abstract promises obscured tasks. | Direct labels: Project budget, Add cost, Costs, New plan, Templates, New note, Requests & quotes. |
| Sidebar | The logo pushed useful navigation down. Icon-only links lacked accessible labels. | Smaller logo, labelled links and persistent section highlighting across related routes. |

Messages remains the default entry point. Budgets and payment records share navigation but remain distinct datasets: combining their totals would double-count project costs already recorded as payments. Receipt attachments belong to saved project costs, not duplicate payment entries.

## Research used

- [Nielsen Norman Group: menu-design checklist](https://www.nngroup.com/articles/menu-design/): visible desktop navigation, clear current location, meaningful and consistent labels.
- [Nielsen Norman Group: progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/): keep common tasks visible and reveal specialised controls when needed. Applied to event creation and accounting columns.
- [W3C: headings and labels](https://www.w3.org/WAI/WCAG21/Understanding/headings-and-labels.html): labels should identify the topic or purpose; they need not be long.

These sources guide the design; they do not prove Flow's usability. The next useful user test is to ask a new user to schedule a dinner, set its budget and attach a receipt without coaching.

## Screenshot review and validation

Reviewed the two supplied screenshots and captured the actual rendered components in an isolated local preview: calendar, event editor, timeline, project list, plans/templates, budgets, payment history, project budget/receipt controls, marketplace and messages. Checked empty states and synthetic birthday-dinner data. These are not screenshots of the user's authenticated production account.

The audit fixture in `apps/web/scripts/ui-audit` is selected only by its own Vite configuration (`npm run audit:ui --workspace @superapp/web`). It never contacts Supabase; writes are disabled. The normal dev/build configuration does not load it.

Automated regression coverage checks the event editor opens and focuses on demand, closes without saving, and preserves section navigation for old URLs. Existing budgeting, upload validation, permission, theme and quote tests remain in the suite. The production build must pass independently of the preview fixture.

## Live release boundary

This interface change adds no database migration. Receipt storage and supplier quotes still require `20261126015336_budget_receipts_supplier_requests.sql` from the preceding PR. The Supabase integration was found but was not yet connected when this review was written. Live uploads, device camera capture and authenticated production flows still require a smoke test after that connection and migration.

Update, 26 November 2026: Supabase is connected and the budget/receipt/quote migration has been applied. Its filename now matches the hosted migration history. See security-and-page-review.md for the subsequent audit.

## Budget table revision

Following feedback, replaced project budget cards, allocation cards and individual cost cards with tables. Amounts use right alignment and tabular numerals; project and cost tables include totals. Missing budget limits remain distinct from zero, and negative balances have an explicit over-budget label. The cost table uses the full page width, with the add/edit form below it. Receipt controls expand beneath the relevant cost, and editing focuses the form.

Tables have captions, row/column headers and keyboard-focusable scroll regions, following [W3C table guidance](https://www.w3.org/WAI/tutorials/tables/). Checked desktop and a 390-pixel iframe viewport with synthetic over-budget, unset-limit, zero-budget and paid/planned/committed examples. Fixed clipped mobile navigation and hidden table headings causing page overflow; the narrow document now fits its viewport while tables scroll independently. Camera/file transfer was not exercised against production. Existing 80 tests, production build and lint on changed TypeScript files pass.
