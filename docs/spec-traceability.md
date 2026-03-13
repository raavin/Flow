# Spec Traceability

Reference spec: `/mnt/c/Users/jason/Downloads/life_coordination_super_app_spec_v_0.md`

## Current implementation snapshot

### Architecture direction now in progress
- A new coordination-object model is being introduced so projects, events, tasks, posts, and DM threads can share a common time/intent/participants/state backbone.
- Reference architecture note: [docs/coordination-object-model.md](/home/jason/projects/superapp/docs/coordination-object-model.md)
- Communication safety and audience framework note: [docs/communication-safety-framework.md](/home/jason/projects/superapp/docs/communication-safety-framework.md)

### Covered in the current scaffold
- Sections `1-3`: reflected in the app shell, shared navigation, notifications entry, and coordination actions.
- Section `4`: welcome, sign-up/sign-in, and onboarding persist through local Supabase auth and profile tables.
- Section `5`: personal and business home dashboards are implemented with live project/event counts plus supportive summary cards.
- Section `6`: projects list and project detail are implemented with milestones, task status changes, attachments, and activity feed.
- Section `7`: calendar page and interactive Gantt/planning page are implemented against persisted project and event data.
- Section `8`: messages hub and thread pages are implemented with text and structured updates.
- Section `9`: template marketplace and products/services marketplace browse surfaces are implemented, including business-side publishing.
- Section `9.3`: listing detail pages are implemented with attach-to-project actions and business profile linking.
- Section `10`: wallet page supports sends, requests, IOUs, and settlement tracking.
- Section `11`: participant management and invite flow are implemented for projects.
- Section `12`: jobs/clients list is implemented as a business work board.
- Section `12.1-12.2`: business profile and business listings management surfaces are implemented.
- Section `14`: notifications page is implemented and fed by several actions across the app.
- Cross-cutting model work: new coordination-object domain types and secure database tables are now in progress as a unifying layer beneath existing surfaces.

### Intentionally partial
- AI assistant is still a shell entry rather than a live orchestration feature.
- Gantt interactions currently support date shifting rather than full drag-and-resize pointer controls.
- Reviews, saved/followed businesses, and richer public business presentation are still ahead.

## Next checkpoints against the spec
- Rebase more of the app onto the coordination-object model so “messages”, “events”, “bookings”, and “projects” become views over the same underlying flow object.
- Add explicit communication visibility/permanence modeling so private chat, shared coordination, public feed, and ephemeral media can coexist safely.
- Evolve templates from task-only imports into reusable multi-block coordination sequences.
- Move the timeline/Gantt toward a multi-track coordination editor rather than a project-only schedule.
- Align onboarding screens more closely with the step-by-step field breakdown in section `16`.
- Replace remaining supportive seeded dashboard cards with richer live summaries.
- Add category browse, comparison, and booking/cart review flows in the marketplace.
- Deepen participant permissions and visibility controls beyond the current role/status model.
- Add richer business job detail tabs and wallet-to-message linking.
- Add browser automation coverage for multi-step flows.
