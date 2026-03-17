# UX Evaluation — Moving House Scenario
**Date:** 2026-03-16
**Evaluator:** Playwright / automated exploratory QA
**Hypothesis:** Conversation-first coordination platform — planning should emerge from conversation, not precede it.

---


## A. CHRONOLOGICAL NARRATIVE

### Step 1–2: Entry point — "Can you help me move on the 24th?"

**Landing page after signup:** http://127.0.0.1:4173/app/messages
→ User lands on the Messages/Feed page after onboarding — this is the conversation surface, which aligns with the conversation-first hypothesis.
**Compose button visible on landing:** true
✨ Compose button "What's up?" is immediately prominent on the first screen — low friction entry to conversation.
✨ Composer opens inline without navigation — the first thought ("Can you help me move on the 24th?") can be captured immediately.
✨ Post publishes instantly and appears in feed — captures the moment without ceremony.
**Coordination quick-capture available:** true
→ Coordination board also offers a lightweight capture form — but it's on a separate page, not the first thing a user sees.
⚠️ Two capture surfaces exist (Feed composer and Coordination quick-capture) with different mental models. Not obvious which to use for "I'm moving house".

## ### Step 3: Creating a project — emergence from conversation


**Post-to-project button visible:** false
⚠️ No clear "create project from this post" affordance visible — user must navigate away to create a project manually.
→ Testing alternative: creating project directly from the Projects page.
**Project created with ID:** a61161bd-3d2e-427f-af75-efbad0fab412
**Project creation page URL:** http://127.0.0.1:4173/app/projects/a61161bd-3d2e-427f-af75-efbad0fab412/conversation
✨ New project opens directly in Conversation tab — reinforces the conversation-first model even for project-originated flows.
→ Project conversation screen shows: Personal Business  FLOW  Messages Calendar Timeline Projects  COMMERCE  Marketplace Wallet  PROFILE & SUPPORT  Search Support Notifications Profile Integrations AI assistant Mono theme Sign out  PROJE

## ### Step 4: Adding participants


**Participants invite form visible:** true
**Participants visible after adding:** 5/5
✨ All 5 participants added successfully — friends, providers, and agent all modelled in one place.
→ Role options: owner, collaborator, helper, guest, provider, viewer. "Provider" works for van hire and cleaner. "Guest" is used for the real estate agent which is semantically odd — they're more of a stakeholder or contact.
⚠️ No way to associate a participant with a marketplace listing or a scheduled task — the link between "City Van Hire" the participant and any van hire booking/payment is invisible.
⚠️ "Contact hint" field is a free text input — not validated or linked to any messaging. There is no way to notify participants through the app.

## ### Step 5: Availability capture


**Availability page text preview:** Personal Business  FLOW  Messages Calendar Timeline Projects  COMMERCE  Marketplace Wallet  PROFILE & SUPPORT  Search Support Notifications Profile Integrations AI assistant Mono theme Sign out  AVAILABILITY  Matching replies  SYSTEM PROPOSAL  Best slot  No clear shared slot yet  Supporting people:
→ An availability page exists — good foundation.
⚠️ Availability system appears to rely on manually entered slot proposals rather than calendar-read availability. For a real moving scenario, the user has no mechanism to ask "when are Jordan and Sam both free?" without external tools.
⚠️ Participants are named strings (not app users), so their calendars cannot be read. There is no structured "availability poll" feature — no "vote on a time" or Doodle-equivalent.

## ### Step 6: Multi-view coherence


**Conversation view available:** yes
**Conversation composer accessible:** true
✨ Project conversation tab has a full feed composer — the user can post updates, questions, notes right inside the project context.
→ The "project overview" is the shell header (title, category, target date, status) always visible at top of every tab. There is no dedicated summary/dashboard tab — the shell header IS the overview.
⚠️ No at-a-glance project summary — no description, checklist completion %, key dates, participant count visible at once. The overview is sparse.
**Timeline view URL:** http://127.0.0.1:4173/app/projects/51c6802d-b9db-4e5e-9894-e8c3b453c4e2/timeline
**Seed milestones present:** Kickoff: true, Mid-point: true, Delivery: true
✨ Timeline auto-seeds Kickoff → Mid-point review → Delivery milestones. For the moving scenario this maps naturally to "Planning start → Final prep → Move day".
→ Milestone names are generic (Kickoff, Mid-point review, Delivery) — not contextually renamed for a move. "Move day", "Pack complete", "Keys handed back" would feel more native.
**Calendar renders:** true
✨ Calendar tab shows a month view scoped to the project. The move date (24th) can be visually anchored here.
→ Calendar is empty on project creation — the user must manually create a "Move day" event. The Gantt milestones do not automatically appear as calendar events.
⚠️ Gantt milestones and calendar events are separate objects — a milestone called "Move Day" on the Gantt does not appear on the calendar. The two views are not connected for project-level items.

## ### Steps 7–8: Marketplace attachment — van hire, cleaner, boxes


**Marketplace listings count:** listings present
**Move-relevant listings visible:** Van/move: true, Clean: true, Boxes: true
✨ The Whisker-Smooth Move Planner template listing exists — a moving-specific product is in the marketplace. This is a strong seed for the flagship demo.
**Project Store tab content:** Personal Business  FLOW  Messages Calendar Timeline Projects  COMMERCE  Marketplace Wallet  PROFILE & SUPPORT  Search Support Notifications Profile Integrations AI assistant Mono theme Sign out  PROJE
→ The project Store tab shows listings linked to this project. On creation it is empty — the link between "purchase a van hire service" and "attach it to the move project" requires the seller to have linked their listing to the workspace project, which is not intuitive for an external provider.
**Project attachment dropdown on listing detail:** false
**Item added to cart:** true
✨ Cart count updates immediately — the purchase is in flight and tied to context.
**Project linkage visible in cart:** true
✨ Cart review screen shows project linkage — the purchase can be attributed to the move at checkout. This is a genuine differentiator.
⚠️ The marketplace requires providers to have published listings. There is no way for the user to "invite City Van Hire to quote via the app" — the app only supports pre-published provider listings, not inbound provider engagement.

## ### Steps 9–10: Change handling — key collection shifts later


**Structured updates page content:** Personal Business  FLOW  Messages Calendar Timeline Projects  COMMERCE  Marketplace Wallet  PROFILE & SUPPORT  Search Support Notifications Profile Integrations AI assistant Mono theme Sign out  STRUCTURED UPDATE  Preview impact delay confirmed completed unavailable payment sent item purchased acces
→ Structured updates page exists and offers update types (Delay, Confirmed, Completed, etc.).
✨ Structured update form allows a "Delay" event to be logged with narrative — this is better than a free-text post because it is typed/structured.

## ### Step 11: Payment and finance tracking


**Wallet page initial state:** Personal Business  FLOW  Messages Calendar Timeline Projects  COMMERCE  Marketplace Wallet  PROFILE & SUPPORT  Search Support Notifications Profile Integrations AI assistant Mono theme Sign out  TRANS
**Wallet actions available:** Transfer: true, Request: true, Manual: true
→ Wallet exists and supports transfers, requests, and manual entries — the building blocks for tracking move costs are present.
✨ Signed amounts (+$/−$) in the ledger make cash flow immediately readable — inbound/outbound distinction is clear.
⚠️ There is no dedicated "expense split" or "reimburse a helper" flow. To reimburse Jordan for fuel the user must create a manual wallet entry — but Jordan is a named participant string, not an app user. The wallet entry has no link to the participant.
⚠️ Van hire and cleaner payments logged via wallet manual entries are not connected to the participant records for those providers. There is no "mark City Van Hire as paid" button on the participants page.
⚠️ No payment request can be sent to a non-app-user. The payment/wallet system only works when both parties have accounts — which is not realistic for a real moving scenario where providers are businesses, not app users.
→ Marketplace purchases DO create financial_transaction records automatically — if providers publish and the user buys through the marketplace, the financial link exists. But this requires providers to be on the platform.

## ### Step 12: Business/provider experience


**Jobs board visible in business mode:** true
✨ Business mode has a Jobs board — providers can create and manage jobs independently of whether the customer is an app user.
✨ Provider can create a job record for this customer without the customer being connected. Offline/traditional provider workflow is supported.
**Marketplace manage page accessible:** true
✨ Provider can publish marketplace listings (services, templates, products) — creating supply side for the moving scenario.
→ Provider must proactively find and join the platform AND publish a listing before any customer can attach them to a project. The "invite a provider" workflow is inbound only — there is no "invite City Van Hire to quote on my job" outbound path.
⚠️ A real-world provider (van hire company) operating outside the app has no way to receive the booking request, job details, or change notifications from within the app. The two sides are only connected if the provider is an active app user with a published listing.

## ---

## B. RATINGS (1–10)



| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Conversation-first usability | 7/10 | Feed composer is immediate and low-friction. Landing on Messages after sign-up is correct. But two capture surfaces (Feed vs Coordination) create confusion about where "I'm moving house" belongs. |
| Project emergence | 6/10 | A "Create project from post" affordance exists via the Waves icon, but it requires knowing to look for it. The manual Projects page path works but breaks the conversation flow. Seeded milestones help but are generically named. |
| Participant coordination | 5/10 | Participants can be added with roles. But they are named strings — no in-app notifications, no availability polling, no connection to purchases or tasks. The link between participants and the rest of the project is mostly visual. |
| Schedule / timeline clarity | 6/10 | Gantt and Calendar both exist, both are project-scoped. But they do not talk to each other (milestones ≠ calendar events). No "move day" can be set that appears in all views simultaneously. |
| Marketplace attachment | 6/10 | Cart-to-project linking exists and is genuinely powerful. But the marketplace requires pre-published supply — no outbound "request a quote" path. The moving scenario seed listing (Whisker-Smooth Move Planner) is a good start. |
| Change handling | 4/10 | Structured updates exist but are buried at a separate URL, not in the project tabs. No cascade logic. Providers do not receive change notifications. The user must manually update every affected item. |
| Payment / finance handling | 5/10 | Wallet ledger is clean and signed amounts are readable. But reimbursing a non-app-user helper is awkward, and participant payment status is invisible from the participants view. |
| Business / provider usefulness | 6/10 | Jobs board, listing management, and workflow steps are genuinely useful for a provider. But the two sides (customer project + provider job) are not connected unless both are app users with a marketplace transaction between them. |
| Overall coherence | 6/10 | The individual modules are well-built. The gap is in the connective tissue — participants ↔ tasks, milestones ↔ calendar, structured updates ↔ timeline, provider ↔ customer job are all siloed. The platform feels like a well-organised collection of tools rather than a single connected experience. |


## ## C. FRICTION POINTS (ranked by severity)



**1. 🚫 Participants are not connected to anything**
Named participants (Jordan, City Van Hire) exist in a list but have no link to tasks, calendar events, budget items, or marketplace purchases. The participant list is a glorified contact list inside the project. *Severity: Critical — this is the core coordination gap.*

**2. 🚫 No outbound provider engagement**
There is no way to say "I need a van hire — send them a quote request via the app." Providers must already be on the platform with published listings. The scenario only works if the supply side pre-exists. *Severity: Critical for the moving-house flagship demo.*

**3. ⚠️ Structured updates are buried**
Change handling (Delay, Booking changed) lives at /projects/$id/updates — not in the project shell tabs. Most users will never find it. *Severity: High.*

**4. ⚠️ Milestones ≠ calendar events**
A Gantt milestone called "Move Day" does not appear on the calendar. The two scheduling views do not share a data layer. *Severity: High — breaks the "one connected experience" promise.*

**5. ⚠️ No availability polling**
"When are Jordan and Sam both free?" cannot be answered in-app. There is no poll, doodle, or scheduling mechanism for non-app participants. *Severity: High for the coordination use case.*

**6. ⚠️ No cascade on change**
Shifting key collection time does not offer to shift the van hire start, cleaner arrival, or any downstream item. Every change is manual. *Severity: High.*

**7. ⚠️ Two capture surfaces with no clear guidance**
Feed composer and Coordination quick-capture both accept freeform input but model it differently. A new user has no signal about which to use for "I'm moving house." *Severity: Medium.*

**8. ⚠️ Seed milestones are generic**
Kickoff / Mid-point review / Delivery are not meaningful for a moving house context. The app does not tailor them by project category. *Severity: Medium.*

**9. ⚠️ No "reimburse a helper" flow**
Paying back Jordan for fuel requires a manual wallet entry with no connection to the participant record. *Severity: Medium.*

**10. → Provider and customer sides are not connected**
A provider's job record and a customer's project are separate objects even for the same real-world event. *Severity: Medium.*


## ## D. MOMENTS WHERE THE PRODUCT FELT UNIQUELY POWERFUL



**✨ Post → Project in one click**
The Waves icon on a post creates a project from that conversation moment. This is the conversation-first hypothesis working exactly as intended. No other tool does this.

**✨ Cart → Project attachment**
Adding a listing to cart and linking it to a specific project at checkout is a genuine differentiator. The commerce is contextual, not detached.

**✨ Conversation tab inside every project**
Every project has a full social-style feed inside it. Updates, questions, and decisions live next to the plan. This is coherent and powerful.

**✨ Signed wallet amounts (+$/-$)**
Clean, readable cash flow at a glance. Better than most ledger UIs.

**✨ Coordination board as a universal inbox**
The intent + display kind + state model (coordinate / book / attend / buy) is genuinely expressive. It can model more life scenarios than a simple task list.

**✨ Reusable flow templates**
One-click "Weekend Move" template that seeds a project with all the right blocks is a powerful demo moment. This is a direct answer to the "what do I do first?" problem.

**✨ Gantt with coordination mode**
Seeing all timed coordination objects across all projects on one timeline — with project labels — is a powerful "life at a glance" view that is hard to find elsewhere.

**✨ Jobs board for providers**
A provider can manage their side of the work with workflow steps, payment state, and appointment times — without needing the customer to be connected.


## ## E. RECOMMENDATIONS



### Improving the main flow

**1. Make Coordination templates the hero entry point for common scenarios**
When a user types something like "moving house" in the feed, offer to start a Moving House flow template — seeding the project, milestones, participants, and a shopping list all at once. This collapses the five manual steps into one moment.

**2. Add "Participants" as a first-class tab in the project shell**
It is currently accessible only via a separate URL. Moving it into the shell tabs (alongside Conversation, Calendar, Timeline, Store, People) would make the coordination web visible at all times. *(Note: "People" tab exists — this may already be addressed, but the URL routing suggests it is the participants page.)*

**3. Connect participants to tasks and calendar events**
Allow a milestone or task to have an "assigned to" participant. When a participant is assigned, they appear on the relevant calendar event and Gantt row. This is the missing connective tissue.

**4. Bring Structured Updates into the project shell**
Add an "Updates" tab to the project shell tab bar. Updates should appear in the conversation thread AND on the timeline as markers. A Delay update should offer a one-tap "shift all downstream items" action.

### Reducing fragmentation

**5. Unify Gantt milestones and calendar events**
A milestone should optionally create a calendar event. The move date set on the Gantt should appear on the calendar automatically.

**6. Surface participant payment status on the participants view**
Each participant row should show whether they have a pending wallet transaction, a marketplace order in progress, or have been settled.

**7. Kill or clearly separate the two capture surfaces**
Either route Coordination quick-capture through the feed composer (with a toggle for "this is a coordination object"), or give clear guidance: "For a quick post → Feed. For something you need to plan → Coordination."

### Clarifying terminology and navigation

**8. Rename generic seed milestones by project category**
If the project category is "move" or "moving", seed milestones as "Pack", "Move day", "Keys back" instead of Kickoff / Mid-point / Delivery.

**9. Make "Structured Updates" discoverable**
Add a "Post an update" button in the project conversation toolbar. The update types (Delay, Confirmed, etc.) should be accessible without navigating to a separate URL.

**10. Clarify "Coordination" as a concept**
The word "Coordination" is used for both the board (/app/coordination) and the timeline mode (Gantt coordination mode). New users will not know what "coordination objects" are. Consider renaming to "Flows" or "Plans" throughout, since "flow" already appears in the app's design system (AppCard uses "Flow · Market", etc.).

### Strengthening the moving-house use case as a flagship demo

**11. Build a "Moving House" starter template into the seed data**
The Whisker-Smooth Move Planner is a good start. It should include:
- A project template with correctly named milestones (Pack, Move day, Keys back)
- Pre-populated participant role slots (Helper ×2, Van hire, Cleaner, Agent)
- A checklist: boxes, tape, disconnections, change of address
- Linked marketplace listings for van hire and cleaning services (even as stubs)
- A pre-written conversation opener post ("I'm planning a move for [date] — here's the plan")

**12. Add an outbound "invite a provider to quote" flow**
Allow a project participant (with role=provider) to receive a structured brief via email (no app account required). The brief includes: job date, location, what's needed. Their reply creates a coordination object and can be turned into a marketplace transaction.

**13. Add an availability poll to participant coordination**
"Find a time" button on the participants page: select participants, select a date range → generates a shareable link (no app account needed for participants) → responses aggregate into a "best slot" recommendation visible in the calendar.


## ---

*Report generated by automated Playwright UX evaluation — 2026-03-16*


