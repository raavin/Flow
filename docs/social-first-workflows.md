# Social use and optional project work

Flow now opens on Home, with Explore, Messages and Notifications available independently of projects. Projects, calendars, templates, suppliers and money remain optional. Existing page URLs continue to work.

## What changed

| Area | Result |
| --- | --- |
| Navigation and appearance | Stable desktop navigation, phone bottom navigation and a More dialog. Explicit appearance selector retains the pre-paint saved theme. Account mode does not replace the core navigation. |
| Sign-in and setup | Short social introduction and minimal account setup. Business details are optional in Settings. |
| Home and posts | Chronological Following, bounded pagination, a simpler composer and common post/media rendering across feed, detail, profile and topic pages. Normal posts no longer generate planning objects. HTML content is rebuilt from an inert formatting allowlist. Posting preserves a chosen username. |
| Replies and deletion | Replies inherit the original conversation's audience on the server. Deleting a post now deletes the actual post atomically with its legacy automatic projection; deliberately created tasks survive with their source removed. |
| Profiles and topics | Follow/message, Edit profile, consistent content rendering and Load more. Profile queries include the profile ID in their cache key. |
| Messages | Inbox previews, timestamps and unread counts, automatic refresh, identity-based direct-thread reuse, send retry IDs and visible errors. |
| Search and notifications | Bounded server-side search can find older posts, people, topics, projects, listings, messages and jobs. Search state stays in the URL. Notifications support Unread/All, Social/Projects and mark-all-read. Help results point to article anchors. |
| Social controls | Mute, block and report from posts, with mute/block management in Settings. Blocking prevents new direct messages and hides posts in both directions. Reports are stored privately; this does not implement a staffed moderation operation. |
| Conversation actions | Create a task, event or project, or add a source link to a project. A stable request ID prevents duplicate actions. Source links preserve the original audience; choosing an action does not publish the source. |
| Projects | Searchable project table, create dialog, shared Conversation/Tasks/Schedule/Budget navigation and secondary Notes/People/Availability/Updates/Listings. Owner-only controls follow access rights. |
| Tasks | Due/in-progress, upcoming, undated and completed groups. Ordinary posts and private conversations are excluded. Task completion synchronises existing task records and their planning projection. |
| Invitations and availability | Invitations bind to an account ID, require the recipient's acceptance and survive username changes. Accepted members can read the project and discuss project tasks. Availability uses dated, local-time Yes/Maybe/No responses. |
| Templates | One preview/apply dialog for starter and marketplace templates; choose steps, anchor date and destination. One transactional application creates dated tasks/events and a versioned definition. Retry does not duplicate the project. |
| Marketplace and quotes | Action beside the relevant request list, supplier comparison table, clear template/service/item actions, and saved items instead of demo checkout. Supplier access stays limited to the published brief and private quote discussion. |
| Money | Tables remain the primary view. Saved project groups, cost/payment links, partial payments, receipts in the shared entry form, and an audit trail for links. A cost is counted once in the budget; its linked payments determine the paid amount. Existing records are not automatically guessed or merged. |
| Supporting pages | Project notes use an editor dialog, legacy People navigation redirects to the shared project context, Connections remains in account utilities, help text follows the current controls, and business/Jobs entry points retain the same core navigation. |

## Data and permissions

Applied migrations:

- `20261127031320_social_workflow_integrity.sql`
- `20261127031338_project_payment_reconciliation.sql`
- `20261127032933_private_project_budgets.sql`

All three were applied to the connected Supabase project. All nine new tables have row-level security enabled. Anonymous callers cannot execute the new workflow, search, delete or financial-link APIs. Demo checkout is no longer executable by signed-in users. The migrations preserve existing posts, project costs and transaction history; old payments are reconciled explicitly through **Link to cost**.

Project financials and receipts remain private to the owner. Budget limits have been backfilled into an owner-only table; the deprecated field on shared project metadata is constrained to remain empty. Accepting a project invitation does not grant access to that owner's finances or private DMs. Shared task comments use project membership; legacy DM planning projections do not. Members can contribute their own work; this release does not grant arbitrary editing of other members' records.

## Verification

- 115 tests across 26 files, including database permission tests executed by PostgreSQL/PGlite.
- Production build and TypeScript checks passed.
- Review regressions cover owner-only budget retrieval, exact migration of limits, Melbourne/negative-offset dates, daylight-saving days, and legacy date-only records. Calendar, timeline and task grouping share the same date conversion.
- ESLint over `apps/web/src`: zero errors and warnings.
- Production dependency audit: zero reported vulnerabilities (`npm audit --omit=dev`).
- Verified new production table RLS and anonymous/signed-in function grants after migration.
- Production search was executed under the authenticated database role with a nonmatching query in a rolled-back transaction.

The earlier whole-site review covered all 48 registered page routes in an isolated preview. New browser screenshots and viewport checks could not be completed: the browser access policy rejected refreshing the local preview. No alternative browser route was used to bypass that restriction. Automated checks do not substitute for the remaining phone/desktop visual and multi-session interaction checks.

The build still reports the existing large JavaScript bundle warning. Supabase still flags leaked-password protection as disabled. Its security-definer warnings also include intentionally exposed, authenticated RPCs; these have explicit identity/ownership checks, fixed search paths and no anonymous execute grants.

## Further product work from the review

The review also describes larger capabilities beyond this release: profile avatars and richer profile views, grouped notification controls, coordinated re-planning of template dates with fixed bookings, shared financial roles, deeper job scheduling, and a moderation operations workflow. They should not be represented as already implemented. The current dated template preview, editable calendar/timeline, private budgets and existing jobs remain usable without those additions.

The interface decisions follow the references in the whole-site review: progressive disclosure, stable adaptive navigation, Carbon table conventions, explicit form feedback and native modal focus handling. A social-only session is a successful use of Flow; starting a project is optional.
