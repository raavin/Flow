# Navigation and mobile workflow

Updated 28 November 2026.

## Changes

- The desktop sidebar keeps its existing appearance. Below 1024 CSS pixels, a labelled Menu button opens the same destinations, account switch, theme control and sign-out in the existing accessible dialog. Closing or navigating dismisses it; moving back to desktop also closes it. Mobile content uses the full available width instead of sharing the screen with an icon rail.
- Project navigation adapts to the width of its own panel. Panels narrower than 44rem show the current page in a **Project page** chooser. Opening it exposes every permitted section, including Availability and Updates. Wider panels retain direct links with an active underline. There is no generic More group.
- The project sequence is Conversation, People (with Availability and Updates), Notes, Tasks, Calendar, Timeline, Budget and Listings. The People group stays highlighted on its child pages. Budget access remains owner-only in both navigation layouts.
- Money and project budgets now share the [integrated budget table](integrated-money-workflow.md): overall funding, optional project groups, projects, allocations and costs. Limits are edited directly in their rows, and receipts stay beside the cost workflow. The desktop menu and project navigation remain as described here.
- Personal and Business navigation share the same order: Messages, Projects, Plans, Calendar, then Jobs for Business. Money comes before Marketplace. Integrations remains in account navigation.
- Marketplace sections share Browse, Requests & quotes, Saved items and My listings links, with the same compact chooser on narrow panels. The selected page is explicit and each section provides a route back to the others.
- Calendar, timeline, request, marketplace-category and job view controls use evenly sized touch targets on phones. These are view filters, not additional global destinations. Their selected state is exposed to assistive technology.
- Dialog headers stay visible when their contents scroll. Project headings can wrap without squeezing the title behind the page actions. Navigation links are anchors rather than buttons nested inside anchors where the navigation was changed.

## Interaction and accessibility

The compact page chooser uses native disclosure behaviour with ordinary links, not application-menu roles. Escape closes it and returns focus to the summary; selecting a page or clicking outside closes it. The app menu uses the existing native dialog for focus containment, Escape and restoration. Navigation controls have a minimum 44px target height.

Repeated navigation keeps the same relative order, following [WCAG consistent navigation](https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation). Narrow layouts expose navigation on demand instead of wrapping many buttons or requiring horizontal scrolling, following [WCAG reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow). Wide financial tables retain their own labelled, keyboard-accessible scroll regions.

## Verification

The route suite covers all 48 registered app page URLs with synthetic signed-in data. Added interaction checks cover app-menu navigation and dismissal, all project-chooser destinations, the active People group, owner-only budget visibility, budget section order, and a round trip through the four marketplace sections.

Validation: all 179 tests passed; the 64 route/interaction checks also passed after the final test typing correction. `npm run lint`, `npm run build` (including TypeScript) and `git diff --check` passed. The build retains its existing large-bundle warning. The change also removes pre-existing lint errors in the two older browser-audit specifications; those specifications have not been executed as part of this change.

The interaction suite uses jsdom, so it does not certify pixel layout, native focus trapping or live uploads. Browser preview access is unavailable in this workspace and no live Flow URL is configured in the repository. A live visual check remains necessary at 320px, 390px, 768px and desktop widths, including all themes, long project names, the expanded page chooser and the open app menu. No changes to database policies, AI setup or payment processing are included.
