# Loading and saves

## Page loading

All 50 route definitions keep their paths, parameters and search validation in a small shared module. Page components load on navigation or link intent. The 22 page modules are separate production chunks; related routes can share a module. Project calendar, timeline and conversation views also use lazy boundaries. The rich post editor loads only when the composer opens.

`npm run build` checks the generated Vite manifest and fails if a page module or the rich editor enters the initial static dependency graph. The existing route smoke suite opens every registered app page. A dedicated test opens a budget project URL directly and checks the selected project survives search parsing.

Measured production JavaScript (minified; decimal kB, not network timing):

| Bundle | Before | After |
| --- | ---: | ---: |
| Initial entry | 1,374.51 kB | 541.70 kB |
| Initial entry, gzip | 395.16 kB | 159.64 kB |
| Messages feature | Included in entry | 60.88 kB |
| Rich editor | Included in entry | 390.86 kB, loaded on demand |

These are build measurements, not a claim about a particular device's load time. The main entry still triggers Vite's 500 kB advisory. Further reduction should be based on profiling rather than dividing shared dependencies into extra requests without evidence.

## Immediate feedback and safe reconciliation

The shared in-memory QueryClient keeps fetched results fresh for 30 seconds and retains inactive results for ten minutes. Explicit writes still invalidate relevant data. Token renewal for the same account no longer blanks the page or reloads the profile. Changing accounts cancels queries, clears private cached data and pending overlays, and prevents queued writes from starting under the new account. A late profile or initial session response cannot replace a newer account.

The optimistic write coordinator cancels competing fetches, applies local changes, serializes writes to the same record, and reconciles with server data. Rollback removes only the failed change: it does not restore an old whole-list snapshot over other successful edits. Background updates and views opened during a save retain pending edits. Patch functions must be idempotent.

Implemented cache updates cover:

- Project creation and edits; tasks, milestones and notes; coordination items and templates.
- Overall and group budgets, project budget amounts, allocations, planned costs and manual money records.
- Whole calendar events, job fields and workflow steps, participant edits/removal, notifications and account mode.
- Social reactions, follows, subscriptions, own-post edits/removal and project links.
- Cart quantity/details/removal and marketplace listing edits/publication state.

New records use client-generated IDs where supported, so a realtime response cannot duplicate a pending row. New budget rows, project links and task controls show a saving state and prevent dependent actions before confirmation. The shared save indicator reports pending writes and failures. Forms retain their existing validation and error messages. Direct messages and replies show pending previews; drafts survive a failed send, and a successful send does not erase newer text typed while waiting.

Not every operation should claim success optimistically. Authentication, uploads, new post publishing, order placement, quote acceptance, invitations, template application and recurring-series splits still wait for the server. Some secondary creation flows, including adding a cart item, also retain their existing pending state. Uploads must finish before receipt/media links can be used. Linked-payment totals and other derived server calculations reconcile from authoritative results. No permissions, RLS policies or database migrations change here. This is not an offline queue: closing the tab can interrupt an unfinished save.

## Render refresh issue

The live `/app/budgets?view=project%3A…` URL returned HTTP 404 before Flow loaded, while `/` loaded the sign-in page. This is a host routing issue, independent of authentication or the selected budget.

For the existing Render static site, add a **rewrite**, not a redirect:

| Source | Destination | Action |
| --- | --- | --- |
| `/*` | `/index.html` | Rewrite |

Render serves existing static assets before applying this fallback. The address and query string must remain intact. The existing `public/_redirects` file is not a substitute for Render's Redirects/Rewrites setting. Adding a Blueprint file alone would also not change an existing unmanaged site.

**Status at this commit:** the live hosting rewrite has not been applied. Render workspace confirmation is still required before inspecting or changing the service. The application deep-link regression test passes, but does not test Render's HTTP handling.

After applying the rule, open the exact budget link in a new tab and refresh it. Verify the app/sign-in screen loads instead of a plain 404; after sign-in verify the project selection. Check a project route and a hashed asset URL as well. This change does not grant access to protected data.

## Verification and references

- `npm test`: 218 tests, including every registered app page, rollback/concurrency, new budget-row scoping, and session/account races.
- `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.
- Signed-in automated route tests use fixtures. A complete production visual review was not performed during this performance change.
- [TanStack Router code splitting](https://tanstack.com/router/latest/docs/framework/react/guide/code-splitting)
- [TanStack Query optimistic updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)
- [Render redirects and rewrites](https://render.com/docs/redirects-rewrites)
