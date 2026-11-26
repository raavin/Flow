# Security and page review — 26 November 2026

## Interface

Use the name of the thing or action as the heading. Removed catchlines, duplicate eyebrow/title pairs, fake quick-action badges and implementation explanations. Messages stays the main entry point. Money retains Budgets and Records as subviews to avoid double-counting expenses.

Added visible form labels, meaningful loading/error states, retry and save feedback; failed submissions retain drafts. Fixed blank optional update dates and existing job notes shown as placeholder text. Removed a replan control that did not implement replanning, and replaced fictitious affected-task names with the actual selected milestone. Project conversations no longer show the unrelated discovery sidebar. Project title editing now has a keyboard-accessible button, and the target date is shown once. Small-screen navigation has visible labels and an account-mode selector. Advanced integration controls use disclosure sections.

## Review coverage

Source review covered every route family. Browser review used the actual components with synthetic data and writes disabled; screenshots were captured for layout decisions.

| Pages | Review |
| --- | --- |
| Home, profile, onboarding, help, notifications, search | Rendered preview and source; login has component test/source review |
| Messages, post, profile, topics, direct messages | Rendered preview and source |
| Projects: conversation, calendar, timeline, notes, budget, store, people, availability | Rendered preview and source |
| Calendar, timeline, plans, plan details, template helper | Rendered preview and source, including earlier interface review |
| Marketplace, category/template/service views, listing, seller, cart, listing management, requests/quotes | Rendered preview and source |
| Jobs and all job tabs, participants, updates, integrations | Rendered preview and source |
| Budgets, records and receipt controls | Earlier rendered preview, source and permission/upload tests |

This is not a claim that every state or device was tested. Live sign-in, real receipt/camera uploads, customer messaging and external integrations were not exercised against production. Small-screen styling needs a device smoke test. The isolated preview modules are excluded from production builds.

## Database hardening

Applied hosted migration `20261126021445_harden_function_access.sql`:

- Revoked anonymous/PUBLIC access to privileged functions; retained authenticated access only for existing signed-in APIs and RLS helpers.
- Restricted integration API-key verification to service_role, matching the Edge Function callers.
- Pinned search_path for six older functions after reviewing their bodies.
- Bound four membership/ownership helper functions to auth.uid(), preventing callers from probing membership for another user.

Live verification: zero anonymous executable privileged functions; zero mutable search paths among the checked functions; API-key verifier unavailable to authenticated clients and available to service_role. SQL regression tests cover own-versus-other-user membership and privileges. No application records were altered.

Advisors still flag 15 authenticated SECURITY DEFINER functions. These are deliberate guarded APIs/helpers, not a reason to blindly revoke every function. Leaked-password protection remains disabled: the connector cannot change Auth configuration, and the dashboard requires sign-in. No claim of a complete penetration test or zero security risk.

The earlier receipt/quote migration is renamed to `20261126015336_budget_receipts_supplier_requests.sql` to match its actual hosted history; SQL is unchanged.

## References

- https://design-system.agriculture.gov.au/foundations/accessibility/clear-communication — headings and labels identify their purpose.
- https://design-system.service.gov.uk/styles/headings/ — consistent heading structure.
- https://supabase.com/docs/guides/database/functions — explicit execution grants and SECURITY DEFINER search paths.
- https://vitest.dev/guide/migration/ — supported Node/Vite versions and test-runner migration.

## Verification

Updated vulnerable dependencies within their supported ranges and upgraded Vitest to 5.1.2. Development now requires Node 22.12+. Final checks: 80 tests pass; production build passes; npm audit reports zero known vulnerabilities (previously 32 including transitive findings). This is a package advisory result, not a guarantee of application security. The existing large production bundle warning remains a performance follow-up.

Lint reports 32 errors and two warnings; the unchanged origin/main tree reports the same 32 errors and two warnings under the updated tooling. These are existing unused variables/imports, escape characters in older end-to-end tests, and memo dependency warnings.
