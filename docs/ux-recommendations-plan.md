# UX Recommendations — Implementation Plan
**Date:** 2026-03-16
**Source:** UX evaluation moving-house scenario + product review

---

## 1 — Structured Updates: Deprecate or Surface?

### Current state
A fully-implemented "Structured Update" page exists at `/projects/$id/updates`. It has:
- A form with typed update kinds (Delay, Confirmed, Completed, Unavailable, Payment Sent, Item Purchased, Access Granted, Assistance Requested)
- Milestone selection, datetime pickers, AI replan toggle
- A feed of past updates

However it is **not** in the project shell tab bar, so most users will never discover it. The conversation stream inside every project has become the primary channel.

### Decision
The structured update form has genuine value (typed, machine-readable events) but in its current state it is dead UI. Two paths:

**Option A — Remove it.** The conversation tab already handles free-form updates. Typed events add complexity the user never asked for. Remove the page, the tab, and the DB writes. Keep the `updates` DB table (removing it risks a migration conflict) but stop writing to it from the SPA.

**Option B — Absorb it into the conversation composer.** Add a "Post update" action to the project conversation tab's composer toolbar. Clicking it opens a compact inline panel (not a new page) with the update kind selector and optional fields. On submit it posts a structured message to the conversation thread. This makes the feature discoverable without fragmenting navigation.

### Recommendation
**Option B.** The typed event model (`Delay`, `Confirmed`, etc.) is a genuine differentiator over a plain conversation thread — it enables future filtering, cascade logic, and API consumers (Shiftly, webhooks). Burying it at a separate URL was the only mistake.

### Plan

#### Migration (none required)
The `project_updates` table already exists.

#### SPA changes
- `apps/web/src/components/project-shell.tsx` — do **not** add an "Updates" tab. Instead, add a "Post update" icon button to the conversation composer toolbar (alongside the existing attachment / emoji slots).
- New component: `apps/web/src/components/structured-update-composer.tsx`
  - Triggered by the toolbar button
  - Renders an inline slide-down panel (not a modal or new page)
  - Fields: update kind (select), optional milestone reference, optional datetime, optional note (pre-fills the conversation post body)
  - On submit: `INSERT project_updates`, then `INSERT posts` with `linked_project_id` and a summary text derived from the update kind
  - Dismissible — collapses back to normal composer state
- `apps/web/src/pages/messages.tsx` (project conversation) — receive the new toolbar button
- Remove the standalone `/projects/$id/updates` route from `router.tsx` and the link from wherever it was exposed — once the inline composer is live, the old page is unreachable clutter

---

## 2 — Timeline Blocks ↔ Calendar: New Block Creation

### Current state
Moving or resizing an existing timeline block already propagates to the calendar (date changes are reflected immediately). The gap is narrower than originally described: **creating a new block does not create a matching calendar entry**. The user must manually add a calendar event separately to see it on the calendar.

### Decision
When a new block is created on the timeline (or from the calendar's "Add block" form), automatically create a corresponding `calendar_events` row so it appears on the project calendar without any extra steps. A checkbox (default ON) lets the user opt out if they want a timeline-only block.

No full sync infrastructure needed — date/title changes to existing blocks already work.

### Plan

#### Migration: `supabase/migrations/20260316160000_milestone_calendar_sync.sql`
```sql
-- Track which calendar event was auto-created from this block
alter table public.milestones
  add column if not exists calendar_event_id uuid references public.calendar_events(id) on delete set null;
```

#### Lib: `apps/web/src/lib/projects.ts` — `createMilestone`
Add an optional `syncToCalendar` boolean (default `true`). When true:
1. Call `createCalendarEvent({ title, starts_at: startsOn, ends_at: endsOn, project_id, is_all_day: true })` first
2. Store the returned `id` as `calendar_event_id` on the milestone insert

Also update `updateMilestone` and `deleteMilestone` to keep the linked calendar event in sync:
- `updateMilestone(id, { title?, startsOn?, endsOn? })`: if the block has a `calendar_event_id`, also update the calendar event's `title`/`starts_at`/`ends_at` to match
- `deleteMilestone(id)`: if the block has a `calendar_event_id`, delete the calendar event first (or change `on delete set null` to `on delete cascade` on the FK so the DB handles it)

#### UI: `apps/web/src/pages/gantt.tsx` (Add block form)
- Calendar sync is ON by default — no checkbox shown
- Small "Don't add to calendar" toggle link below the form fields; clicking it sets `syncToCalendar = false` and shows a muted "Won't appear on calendar" note so the user has confirmation

#### UI: `apps/web/src/pages/calendar.tsx` (Add block form)
- Same pattern — syncs to calendar by default, opt-out link available
- Calendar's `createMilestoneMutation` already calls `createMilestone` — just pass through `syncToCalendar`

---

## 3 — Moving House Marketplace Template

### Decision
Create a "Weekend Move Planner" template listing in the marketplace. It is free (`price_cents = 0`). Purchasing it (or using "Import template") applies a complete project scaffold: named milestones, participant role slots, a task checklist, and a pre-written conversation opener post.

The purchase/import flow already exists (the Whisker-Smooth template demonstrates it). The work here is content — a richer template definition — and wiring the template payload to seed all the new objects.

### Plan

#### Seed data
New seed file or append to existing marketplace seed:
- Listing: `title = "Weekend Move Planner"`, `kind = 'template'`, `price_cents = 0`, `is_published = true`
- Template payload (JSON stored on the listing or in a `template_data` column):
  ```json
  {
    "project": {
      "title": "Weekend Move",
      "category": "move"
    },
    "milestones": [
      { "title": "Pack complete",     "offset_days": -7  },
      { "title": "Move day",          "offset_days": 0   },
      { "title": "Keys handed back",  "offset_days": 3   }
    ],
    "tasks": [
      "Book van hire",
      "Book cleaning service",
      "Confirm helper arrivals",
      "Order moving boxes",
      "Notify utilities of change of address",
      "Redirect mail",
      "Final walkthrough of old property"
    ],
    "participant_slots": [
      { "label": "Helper",    "role": "helper",       "count": 2 },
      { "label": "Van hire",  "role": "provider",     "count": 1 },
      { "label": "Cleaner",   "role": "provider",     "count": 1 },
      { "label": "Agent",     "role": "collaborator", "count": 1 }
    ],
    "conversation_opener": "Moving day is locked in. Here's the plan — milestones, helpers, and tasks are all set up. Let's coordinate from here."
  }
  ```

#### DB: template_data column
```sql
-- In new migration: 20260316170000_template_data.sql
alter table public.marketplace_listings
  add column if not exists template_data jsonb;
```

#### Lib: `apps/web/src/lib/marketplace.ts`
- `applyTemplate(listingId, projectId)`:
  - Fetches `template_data` from the listing
  - Creates milestones (with calendar sync if target date is known)
  - Creates tasks for each task string
  - Creates participant slot placeholders (name = slot label, role = slot role)
  - Posts the `conversation_opener` to the project conversation
  - Returns `{ projectId }` so the SPA can navigate to the project

#### Purchase flow
- After `place_order_from_cart()` for a template listing, the order completion screen shows "Apply to a project" button (same as the current "Import template" flow but post-purchase)
- `applyTemplate` is called with the selected project (or a new project created inline)

#### UI
- `apps/web/src/pages/listings.tsx` — "Import template" / "Apply to project" button already exists; make it call `applyTemplate` with the full payload
- Show a confirmation screen listing what will be created before applying

---

## 4 — Availability Poll with Email-Based Participation

### Concept
A project owner can send an availability poll to participants who are **not app users**. Participants receive an email with a magic-link-style URL. Clicking it opens a lightweight polling page (no account required). Their responses aggregate into a "best slot" recommendation visible in the project calendar. After submitting, they are gently invited to create an account.

### Plan

#### DB: `supabase/migrations/20260316180000_availability_poll.sql`
```sql
create table public.availability_polls (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  creator_id   uuid not null references public.profiles(id),
  title        text not null default 'When are you available?',
  date_options jsonb not null default '[]',  -- [{ "date": "2026-03-24", "label": "Tuesday 24 Mar" }]
  status       text not null default 'open' check (status in ('open', 'closed')),
  created_at   timestamptz not null default timezone('utc', now()),
  closes_at    timestamptz
);

create table public.availability_poll_responses (
  id         uuid primary key default gen_random_uuid(),
  poll_id    uuid not null references public.availability_polls(id) on delete cascade,
  token      text not null unique,  -- random token in the magic link
  name       text not null,         -- respondent name (from participant record)
  email      text,
  available_dates jsonb not null default '[]',  -- ["2026-03-24", "2026-03-25"]
  responded_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

-- RLS: polls readable by project participants; responses readable by poll creator only
```

#### Edge function: `supabase/functions/poll-respond/index.ts`
- Public endpoint (no auth required)
- GET `?token=<token>` → returns poll options and respondent name (confirms token is valid)
- POST `?token=<token>` with body `{ available_dates: string[] }` → updates `availability_poll_responses.available_dates` and `responded_at`
- Token is single-use for writing (can re-respond before poll closes)

#### Email delivery
- When `availability_polls` is created, an edge function (or DB trigger) sends emails to each `availability_poll_responses` row that has an email address
- Email contains: poll title, project name, direct link to `/poll/<token>` public page
- For now: use Supabase's built-in `pg_mail` or an edge function calling Resend/SendGrid (provider TBD — pluggable)

#### Public poll page: `apps/web/src/pages/poll.tsx`
- Route: `/poll/:token` — outside the authenticated `appRoute`
- Fetches poll options via `poll-respond` edge function (GET)
- Shows date option checkboxes, submit button
- On submit: POST to `poll-respond`
- After submit: shows "Thanks, your availability has been recorded." + "Want to coordinate everything in one place? Create a free account →"

#### Project calendar integration
- `apps/web/src/pages/projects/calendar.tsx` (or the project calendar component): if an open poll exists for this project, show a banner "Availability poll in progress — X of Y responded" with a "View results" button
- Results modal: for each date option, show which participants are available (green) / haven't responded (grey). Highlight the date with the most availability.
- "Best slot" = date with most `available` responses

#### UI: participants page or project shell
- "Find a time" button in participant list view
- Opens an inline form: select date options (date pickers, add up to 7), optional title
- Creates poll + sends emails to participants with email addresses
- Participants without email addresses shown as "Can't send — no email" with a copy-link fallback

#### Account encouragement
- After responding via magic link: show soft CTA with project name visible ("You're helping coordinate **Weekend Move** — everything's in one place if you join")
- If they click "Create account", pre-fill email from the poll token record

---

## 5 — Provider Engagement: Companies Working Inside the App

### Philosophy
The vision is that providers (van hire company, cleaner, real estate agent) operate their side of the coordination **natively inside the app**, not via email workarounds. This means:
- A job request from a customer arrives as a structured object in the provider's app account
- The provider responds, accepts, quotes, and completes the job from their dashboard
- Both sides see the same status in real time
- Payment flows through the platform

The current gap: providers must be pre-registered with a published listing before any customer can attach them. There is no inbound path ("I need City Van Hire — here's a brief") and no notification mechanism.

### Plan

#### A — Job Request (outbound from customer)
When a customer adds a participant with `role='provider'` and supplies a contact email or phone, they can send a **job brief** directly from the participants page.

- "Send job brief" button on a provider participant row (visible when role=provider and contact info exists)
- Opens a form: job date, location, description of what's needed, optional budget
- On submit:
  - Creates a `job_requests` record (new table) linking the customer's project to the contact details
  - Sends an email to the provider email address with:
    - Job summary
    - A magic-link URL: `/jobs/request/<token>`

#### New table: `job_requests`
```sql
create table public.job_requests (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  requester_id      uuid not null references public.profiles(id),
  provider_email    text not null,
  provider_name     text not null,
  token             text not null unique,   -- magic link token
  status            text not null default 'sent'
                      check (status in ('sent','viewed','accepted','declined','completed')),
  job_date          date,
  location_text     text,
  description       text not null,
  budget_cents      integer,
  provider_profile_id uuid references public.profiles(id),  -- set when provider signs up
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now())
);
```

#### B — Provider landing page (no account required)
Route: `/jobs/request/:token` — public, outside authenticated shell.

Shows:
- Job summary (date, location, description, budget)
- Customer's name and project name
- Two action buttons: **Accept job** / **Decline**
- If accepted: shows a lightweight "job accepted" confirmation + "Create a free business account to manage this job, send quotes, and get paid in the app →"

Accepting sets `status='accepted'` and creates a preliminary `jobs` record in the business dashboard (if the provider has an account). If no account: stores the acceptance in `job_requests` and shows the sign-up CTA.

#### C — Provider sign-up from job request
- Sign-up URL carries `?job_token=<token>` param
- After onboarding: automatically links `job_requests.provider_profile_id = new_profile.id`
- Redirects to business dashboard → jobs section with the job pre-populated
- The job record shows: customer name, project, date, description — ready to work from day one

#### D — Connected job: customer ↔ provider visibility
Once both sides have accounts and the job is linked:
- Customer project's participants list shows the provider with a live status badge (Accepted / In progress / Completed)
- Provider's jobs board shows the customer project name as the "source" of the job
- Provider can post updates from their jobs board that appear as structured updates in the customer's project conversation (via the `project_updates` mechanism from Recommendation 1)
- Payment: provider can send a payment request via the wallet (`Request` action) that the customer sees in their wallet as a pending item linked to the project

#### E — Marketplace listing path (existing providers)
For providers already on the platform with published listings, the existing purchase path remains the primary route. The job request path is the **inbound path for cold-start providers** who aren't on the platform yet.

The two paths converge at the `jobs` table — a job created from a marketplace purchase and a job created from a job request both become the same object type in the provider's dashboard.

#### F — Making it compelling for companies
Beyond the job request flow, features that make the platform the natural place for providers to work:

1. **Business dashboard jobs board** (already exists) — surfaced prominently as the provider home screen
2. **Client list** — providers can see all customers who have them as a participant across projects
3. **Calendar view** — all jobs by date across all clients
4. **Quote flow** — provider can send a quote from a job record; customer sees it as a wallet request linked to the project
5. **Marketplace as shop window** — once a provider has completed a job, they can publish a service listing and be discoverable by new customers
6. **Provider referrals** — when a customer completes a move and rates the provider, a `testimonial` can optionally be published on the provider's marketplace listing

---

## Build Order

```
Phase A — Structured Updates inline composer (Rec 1)
  1. New component: structured-update-composer.tsx (inline panel)
  2. Wire into project conversation composer toolbar
  3. Remove standalone /projects/$id/updates route

Phase B — Milestone ↔ Calendar sync (Rec 2)
  4. Migration: milestone.calendar_event_id FK
  5. Update createMilestone / updateMilestone / deleteMilestone
  6. Add "Also add to calendar" checkbox to Gantt milestone form

Phase C — Moving House template (Rec 3)
  7. Migration: marketplace_listings.template_data jsonb
  8. Seed: Weekend Move Planner listing with full template_data payload
  9. Lib: applyTemplate() creating milestones, tasks, participants, opener post
  10. Wire applyTemplate into Import template / post-purchase Apply flow

Phase D — Availability poll (Rec 4)
  11. Migration: availability_polls + availability_poll_responses
  12. Edge function: poll-respond (GET token, POST response)
  13. Public page: /poll/:token (no auth)
  14. UI: "Find a time" button on participants page
  15. UI: poll results view in project calendar
  16. Email sending for poll invites

Phase E — Provider engagement (Rec 5)
  17. Migration: job_requests table
  18. Edge function: job-request handler (send email, accept/decline)
  19. Public page: /jobs/request/:token
  20. UI: "Send job brief" on provider participant row
  21. Sign-up flow with job_token param linking new account to job
  22. Customer-side: live status badge on provider participant
  23. Provider-side: job source attribution in jobs board
```

---

*Plan document — no implementation has begun*
