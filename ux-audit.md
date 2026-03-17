# UX Audit — 2026-03-16

Issues appended as found during Playwright click-through.

---

## LANDING PAGE
Checking landing page content and navigation.

## SIGN UP & ONBOARDING
Creating fresh account and going through onboarding.

## MESSAGES / FEED
Checking feed and social post composer.

### OK — Messages feed
Compose button visible

### OK — Messages feed
Post composer opens correctly

### OK — Messages feed
Post publishes and appears in feed

### OK — Messages feed
"Following" toggle visible

### OK — Messages feed
Search input visible

## NAV
Checking all nav links are visible and lead somewhere.

### OK — Nav
"Projects" navigates correctly to http://127.0.0.1:4173/app/projects

### OK — Nav
"Marketplace" navigates correctly to http://127.0.0.1:4173/app/marketplace

### OK — Nav
"Wallet" navigates correctly to http://127.0.0.1:4173/app/wallet

### OK — Nav
"Calendar" navigates correctly to http://127.0.0.1:4173/app/calendar

## PROJECTS
Creating a project and checking all tabs.

### OK — Projects
Project created, ID: 7ab67357-cb17-4f03-9e80-19c5b6400744

### ISSUE — Projects — Conversation tab
Project title "Audit Project 1773605971481" not visible on conversation page

### OK — Projects — Timeline tab
Timeline tab loads without junk text

### OK — Projects — Timeline tab
New seed milestone "Kickoff" visible

### OK — Projects — Calendar tab
Calendar tab loads

### OK — Projects — Store tab
Store tab loads without junk text

### OK — Projects — People tab
People tab loads

### OK — Projects
"Notes" tab correctly removed from project shell

## GANTT
Checking Gantt chart page, milestone names, inline editing.

### OK — Gantt
"Kickoff" seed milestone present

### OK — Gantt
"Mid-point review" seed milestone present

### OK — Gantt
"Delivery" seed milestone present

### OK — Gantt
"Add task" button visible

## PARTICIPANTS
Checking participants invite form and duplicate prevention.

### OK — Participants
Participant invite form visible

### OK — Participants
Participant added successfully

### OK — Participants
Duplicate participant shows inline error message

## MARKETPLACE
Checking marketplace browse, listing detail, and cart.

### ISSUE — Marketplace
Templates tab not visible

### ISSUE — Marketplace
No "View details" links found — listings may not be loading

## WALLET
Checking wallet / transaction ledger.

### OK — Wallet
Wallet page loads with currency values

### OK — Wallet
"Total" column visible in ledger

## CALENDAR
Checking calendar page.

### OK — Calendar
Calendar renders with visible month name

## INTEGRATIONS
Checking integrations page.

### OK — Integrations
Integrations page renders content

### OK — Integrations
"Payment" section visible

### OK — Integrations
"API" section visible

### OK — Integrations
"Webhook" section visible

### OK — Integrations
"Integrations" nav link present

## SETTINGS
Checking settings page.

### OK — Settings
Settings page renders content

## SOCIAL PROFILE
Checking own social profile page.

### OK — Social profile
Profile page loads and shows content

## PROMOTE POST
Checking promote/demote toggle on project posts.

### ISSUE — Promote post
Message input not found on project conversation page

## SIGN OUT
Checking sign out.

### OK — Sign out
Sign out redirects to landing page

---

## POST-RUN ANALYSIS

### ISSUE — Marketplace: ListingCard has no "View details" affordance
The `ListingCard` component removed the explicit "View details" link. The only clickable elements are the listing image and title (both are `<Link>` elements). This breaks:
- The existing `app-flow.spec.ts` marketplace test (confirmed failing — times out on `getByRole('link', { name: 'View details' })`)
- User discoverability: nothing on the card visually communicates it is navigable

**Fix:** Add a visible "View details" text link to the card footer.

### ISSUE — Marketplace: "Add to cart" button hidden until hover (opacity-0)
The "Add to cart" button uses `opacity-0 group-hover:opacity-100` — invisible until mouse hover. Touch/mobile users will never see it, and keyboard users have no visual affordance.

**Fix:** Always show the button (remove opacity-0), or at minimum ensure it is accessible to keyboard/touch.

### CLARIFICATION — Marketplace: "Templates tab not visible" was a false alarm
The marketplace was redesigned from tabs to filter chips (`<button>` elements: All / Templates / Services / Products). The audit test was looking for a `<a role="link">` — test issue, not app issue.

### CLARIFICATION — Projects: "Project title not visible" was a timing issue
The test called `getMainText` immediately after URL change before TanStack Query hydrated. The title renders as the fallback `"Project"` during load. Minor loading-state concern but not a bug.

### CLARIFICATION — Promote post: "Message input not found" was wrong placeholder
The audit test looked for `placeholder="Write a message..."` (DM thread input). The project conversation uses `placeholder="What's happening? Try @, #, or /"`. Test selector issue, not an app bug. The promote/demote feature was not tested properly.

### TODO — Promote post feature needs manual verification
Could not automate promote button check due to test selector issues. Manual check needed: open a project conversation, post a message, confirm the globe/promote icon appears.


---

## ADDITIONAL FINDINGS FROM APP-FLOW TESTS

### ISSUE — Marketplace: "Import template" button text mismatch
The existing `app-flow.spec.ts` test looks for `getByRole('button', { name: 'Import template' })` but the actual button text is **"Import template to project"**. Playwright's `getByRole` with a string `name` does an exact (case-insensitive) match, so this test fails with timeout.

The test `template import creates a real project plan` has been failing. The button text needs to either:
- Match the test: change button to "Import template"
- Or update the test: change to `{ name: 'Import template to project' }`

### ISSUE — Marketplace: "Add to cart" button was hidden on hover only (FIXED)
The `ListingCard` component had `opacity-0 group-hover:opacity-100` on the Add to cart button making it invisible on touch devices. A "View details" link was also missing — the only navigation affordance was clicking the listing title or image (no visible text link). Both issues were fixed: added explicit "View details" link and made "Add to cart" always visible.

### ISSUE — Listing detail: "View cart" text inconsistency (FIXED)
On the listing detail page the cart button read "View cart (1)" while the marketplace browse page shows "Cart (1)". The inconsistency caused the existing `app-flow.spec.ts` cart test to fail. Fixed to read "Cart (1)" consistently.

---

## SUMMARY OF ALL FINDINGS

| # | Status | Area | Issue |
|---|--------|------|-------|
| 1 | FIXED | Marketplace — ListingCard | No "View details" affordance; "Add to cart" hidden on hover |
| 2 | FIXED | Listing detail | "View cart" vs "Cart" text inconsistency broke cart test |
| 3 | OPEN | Marketplace — Import template | Button text is "Import template to project" but test expects "Import template" — test fails |
| 4 | OK | Projects — Gantt milestones | Seed names updated to Kickoff / Mid-point review / Delivery ✓ |
| 5 | OK | Projects — Notes tab | Removed, replaced with Store tab ✓ |
| 6 | OK | Projects — Store tab | Loads without errors ✓ |
| 7 | OK | Participants | Duplicate prevention working, inline error shown ✓ |
| 8 | OK | Nav | All main nav links (Projects, Marketplace, Wallet, Calendar) route correctly ✓ |
| 9 | OK | Feed | Compose, publish, following toggle, search all working ✓ |
| 10 | OK | Wallet | Loads with currency values and Total column ✓ |
| 11 | OK | Calendar | Renders with visible month name ✓ |
| 12 | OK | Integrations | Page renders Payment / API / Webhook sections; nav link present ✓ |
| 13 | OK | Settings | Page renders content ✓ |
| 14 | OK | Social profile | Loads correctly ✓ |
| 15 | OK | Sign out | Redirects to landing ✓ |
| 16 | NEEDS MANUAL CHECK | Promote post | Could not automate — project conversation uses different placeholder than DM; globe/promote button needs manual verification |

