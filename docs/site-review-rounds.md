# Flow: site review and fixes

Reviewed 28 November 2026. Baseline: `227d95e4a8f6539af096a1b0fee953bc39882761`.

## Scope and evidence

Three passes covered the app: live navigation and layouts; workflow and accessibility corrections; then failure, security and regression checks. The familiar sidebar, personal/business modes, project navigation, budget tables and comms-first entry point are retained.

Live browser inspection included the signed-in feed, profile, private inbox, project list, project conversation, people, availability, updates, notes, tasks, calendar, timeline, budget and listings; Plans and plan details; Templates and the template editor; global calendar and timeline; overall budgets, activity and the receipt-capable entry form; marketplace, a template listing, saved items, requests, the quote form, listing management, notifications, settings, integrations, search and help. Screenshots were inspected for the feed, project workspace, calendar, money table and marketplace.

The route regression suite renders **every registered app route** against deterministic fixtures, including job pages, seller/category pages, quote details, topics and populated private conversations where this account did not have corresponding live records. It verifies query success, navigation, nonempty content, accessible form names, no nested link/button controls and no `/undefined` or `/null` destinations. This is not a claim that every production record, phone viewport or mutation was exercised. Live review did not publish posts, send messages, change financial records or create supplier requests.

## Pass 1: workflow and clarity

| Area | Observed weakness | Implemented change and reason |
| --- | --- | --- |
| Plans and template editor | Create template opened the full Plans dashboard, with the form below unrelated content. | Template editor now shows the template form directly. Saving returns to Templates. Its unrelated project/plan queries are disabled. |
| Plans | A full creation form preceded the existing work, especially burdensome on a phone. | New plan opens a focused modal. Existing plans remain the initial content; drafts remain in page state when the modal closes. The form supports Enter, required fields and an end-date minimum. |
| Plan terminology | Links alternated among “flow”, “task” and “plan”. | Use Open plan and All plans consistently; simplify empty-state copy. |
| Feed and conversations | Very old posts showed values such as “6092h”. | Minutes/hours for recent posts, days for the last week, then readable calendar dates. Feed timestamps expose the full date on hover. |
| Marketplace | Ownerless starter listings linked to seller/undefined; listing details could show Loading seller indefinitely. | Render a plain source label for starter listings, do not link to an absent seller, and do not start related-seller requests or a review form without a seller. |
| Search previews | Adjacent rich-text paragraphs ran together. | Preserve spaces at paragraph, list and line-break boundaries when generating plain-text excerpts. |
| Project money | An Open project link returned to the project already surrounding the budget. | Show it only when viewing a budget outside that project workspace. Budget hierarchy and inline rows remain intact. |

## Pass 2: controls, accessibility and resilience

- Converted 25 links containing buttons into single styled links. Their existing visual treatment is retained, with one focus target and normal link behaviour.
- Named search, reply/message, invitation and timeline-filter controls; named saved-item project/date/note fields.
- Added semantic page heading levels without changing the design system's typography. Calendar date buttons announce their complete date, selected state, today and item count.
- Notification filters announce their selected state. Mark all read uses the shared optimistic layer and only the unread IDs present when clicked; failures roll back through the existing mechanism.
- Initial session or profile failures now show a recoverable account error with Retry, instead of an endless loader or misleading onboarding state. Existing same-user token refresh and account-switch isolation are retained.
- Sign-up no longer immediately attempts a password sign-in when Supabase requires email confirmation.
- Authentication and onboarding preserve a validated local destination, including a selected project budget. Stale onboarding results cannot populate a different signed-in account.

## Pass 3: security and final verification

### Implemented

- Notification destinations and post-auth return URLs are restricted to local `/app/` paths. External schemes, protocol-relative URLs, backslashes, controls, invalid encoding and path traversal out of the app are rejected.
- Rich-text sanitization rejects backslash/control-character link tricks; executable elements and attributes remain blocked.
- Live Supabase inspection found **zero deployed Edge Functions, zero connected integrations, zero integration keys and zero webhook endpoints**. The UI nevertheless offered external connection and API controls.
- Integration setup is now explicitly unavailable instead of exposing nonfunctional connect/key/webhook actions. Budgets and receipt tracking continue without external services. AI setup/generation has not been added.
- The undeployed OAuth connect/callback and webhook-dispatch prototypes are replaced with fail-closed 503 handlers. They contained predictable OAuth state, incomplete token persistence and webhook claim/SSRF safeguards. They must not be deployed as working integrations. No production functions or database policies were changed.

Before implementing integrations: require unpredictable, expiring, single-use OAuth state bound to the initiating account and provider; consume state atomically; keep PKCE and tokens server-side; verify token persistence before reporting success; use fixed provider redirects; authenticate scheduled jobs; atomically claim webhook work; enforce public destination/egress rules including redirects and DNS; bound response reads; and test account isolation, replay and concurrent delivery. Merely adding a feature flag does not meet these requirements.

### Checks

- 242 tests pass across 35 test files, including route coverage, dialogs, receipt controls, auth failures/races, URL validation, formatting, optimistic rollback, supplier permissions and budget ownership.
- TypeScript production build and ESLint pass.
- Production build verifies 22 lazy page modules plus a separate rich-text editor chunk.
- `npm audit --omit=dev`: zero known vulnerabilities reported. This does not prove the absence of application vulnerabilities.
- Initial bundle remains approximately 543 kB (160 kB gzip), above Vite's 500 kB advisory. Do not weaken the lazy-loading checks to hide it.

### Still outstanding

1. **Render refresh routing:** direct `/app/...` requests need a Render rewrite from `/*` to `/index.html`. The existing Netlify-style `_redirects` file does not configure Render. Authentication fixes do not fix that hosting 404. The Render workspace selection has not yet been confirmed, so no hosting mutation was made.
2. **Supabase password protection:** leaked-password protection is disabled. Enable through the project's auth settings when supported by its plan; this connector did not provide that setting.
3. **Database follow-up:** advisors reported 22 authenticated security-definer warnings, plus 107 RLS init-plan, 178 overlapping-policy, 89 unindexed-foreign-key and 25 unused-index findings. These require function/policy-specific review and workload evidence. Bulk grant removal, policy rewrites or index churn would be unsafe. The health advisor reported no findings; existing ownership tests pass.
4. **Further live testing:** multi-account collaboration, a real supplier quote exchange, receipt upload on a physical phone, and populated business jobs require controlled test data/accounts. This review did not create production transactions to claim that coverage.
5. **UX follow-up:** timeline fit-to-content/current-period behaviour, empty search-page density, and keyboard access to older inline editing controls deserve dedicated passes. Keep those changes separate from a navigation redesign.

## References used

- [W3C: Labeling controls](https://www.w3.org/WAI/tutorials/forms/labels/) — durable names independent of placeholders.
- [W3C: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) — keep page navigation and forms usable without forcing the whole page sideways; wide data tables may retain a contained scroll region.
- [W3C: Error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html) — visible errors and a usable recovery action.
- [OWASP: Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) — enforce ownership in trusted code, deny by default, test boundaries.
- [OWASP: Unvalidated redirects](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html) — validate destinations rather than trusting stored or URL-supplied links.
- [Supabase: JavaScript signUp](https://supabase.com/docs/reference/javascript/auth-signup) — a null session is expected when email confirmation is enabled.
- [Supabase changelog](https://supabase.com/changelog.md) — checked before the backend review; no database or CLI upgrade was performed.
