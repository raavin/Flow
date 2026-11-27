# Interface repair after PR #7

PR #7 replaced the established sidebar, hid project pages under a More control, and changed the Plans destination. This repair restores the familiar navigation while retaining the privacy, identity, budgeting and receipt work.

- Restore the themed sidebar, logo, Personal/Business switch, visible account links, appearance control and sign out. Restore horizontal icon-and-label alignment on desktop and the existing narrow sidebar on small screens.
- Show Conversation, Tasks, Calendar, Timeline, Notes, Budget, Listings and People directly in project navigation. Keep the owner-only budget restriction. Availability and Updates remain connected through the People section, with the current view identified.
- Restore the Plans overview and its existing creation controls. Keep the task list in project Tasks and plan Steps, and keep the template catalogue and editor available.
- Restore project navigation on Updates. Remove the duplicate header, close button and nested card from the post composer. Fix modal border colours and focus restoration.
- Prevent blocked browser storage from crashing project pages. Catch rendering failures within the page, retaining the sidebar and a retry control instead of replacing the entire app with a developer error screen.
- Update the isolated review fixtures for the current private-budget schema, ownership and read RPCs. They contain synthetic data and are never loaded by normal dev or production builds.

Verification uses all 48 app route URLs with synthetic signed-in data, plus navigation, composer, project form, both receipt entry points, and page-failure recovery. A coverage check compares the tested URLs against every registered app page. The native dialog APIs and scrolling are stubbed in jsdom; these checks do not verify browser layout, native focus trapping, or production uploads. The previous local browser preview is unavailable, so this repair does not claim a completed live visual check.

No database schema or policy rollback is included.
