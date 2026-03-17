# Personal Core Plan
**Date:** 2026-03-17
**Product sentence:** Capture ideas, turn them into plans, and carry them through to execution in one place.

---

## The strategic problem this solves

The app currently has everything it needs to be powerful — projects, timeline, marketplace, wallet, coordination, conversation. What it lacks is the reason someone opens it on a Tuesday morning when nothing big is happening.

Without a personal productivity core, it is a tool you visit for events, not a place you live in. The goal of this plan is to fix that.

The target is not to beat Notion at notes or Todoist at tasks. It is to be **good enough that someone can run their daily life and small projects here without constantly jumping out**.

---

## The four layers (existing + planned)

| Layer | Purpose | Status |
|---|---|---|
| **1. Personal workspace** | Notes, lists, quick capture, solo use | ✗ Missing |
| **2. Project / workflow** | Structure, timeline, phases, dates | ✓ Exists (strong) |
| **3. Shared coordination** | People, conversation, availability, updates | ✓ Exists (good) |
| **4. Commerce / finance** | Services, costs, payments, marketplace | ✓ Exists (good) |

The app is strong at layers 2–4 and missing layer 1. That is why it feels situational rather than daily.

---

## The four object types

The personal core introduces a clear object hierarchy. Each type is useful alone and upgradeable to the next.

### Note
Freeform capture. Thought, reference, idea, journal entry, brainstorm.
- No required fields beyond a body
- Rich enough editing (bold, lists, headings — not a word processor)
- Taggable, pinnable, searchable
- Can live standalone or inside a project

### List
Actionable items. Groceries, errands, packing, admin.
- One-tap item creation
- Drag to reorder
- Check off items
- No dates required
- Can live standalone or inside a project

### Flow
A lightweight structured sequence. Bigger than a list, smaller than a full project.
- Ordered steps with optional dates
- No participants, no timeline, no budget required
- Maps to the existing **coordination object** model (`display_kind = 'flow'`)
- Examples: morning routine, weekly review, recurring pre-trip checklist

### Project
Multi-step container with timeline, participants, costs, and coordination.
- Already exists and is well-built
- The destination that Notes, Lists, and Flows can upgrade into

### Conversion paths (the bridge)

```
Note      →  List
Note      →  Flow
Note      →  Project
List      →  Flow
List      →  Project
Flow      →  Project
Checklist item  →  Task
Note section    →  Task group
Note with dates →  Timeline suggestion
Brainstorm note →  AI-generated project plan
```

This conversion chain is the product differentiator. Notes apps can't do it. PM tools don't start at the idea stage.

---

## What needs to be built

### 1. Notes

**New page:** `/app/notes`
**New DB table:** `notes`

```sql
create table public.notes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  title       text,                        -- optional, derived from first line if blank
  body        text not null default '',    -- markdown or plain rich text
  tags        text[] not null default '{}',
  is_pinned   boolean not null default false,
  project_id  uuid references public.projects(id) on delete set null,  -- if attached to a project
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);
```

**Features:**
- Quick create from the Notes page (click anywhere or press N)
- Title auto-derived from first line if not set explicitly
- Rich text: bold, italic, headings, inline checklist, code block
- Inline checklist items that can be promoted to tasks
- Pin notes to the top of the list
- Tags: freeform, shown as pills, filterable
- Search across all note bodies
- "Move to project" action — sets `project_id`, note then appears in project's Notes tab
- "Turn into project" action — creates a project using the note title as the project title, body as the first conversation post
- "Turn into plan" action — sends body to AI, returns a structured project with milestones and tasks

**Project integration:**
- A `Notes` tab in the project shell (joins the existing Conversation, Calendar, Timeline, Store, People tabs)
- Shows notes where `project_id = this project`
- "New note" button pre-sets the project

---

### 2. Lists

Lists are a subset of the coordination object model. A new `display_kind = 'list'` is sufficient — no new table needed.

**New page:** `/app/lists` (or merged into Notes as a toggle view)

**Features:**
- One-tap item add (just type and press Enter)
- Drag to reorder
- Check off items (updates coordination object state or a sub-item model)
- No dates required by default — add a date only when wanted
- "Convert item to task" — promotes a list item to a dated task in a project
- "Move list to project" — attaches the coordination object to a project
- "Turn into flow" — promotes the list to an ordered flow with optional dates per step

**Implementation note:** The coordination board already models ordered, typed objects. A `kind = 'coordinate'` + `display_kind = 'list'` coordination object with child items (or a `metadata.items` array) covers this without a new table. Evaluate whether child items need a sub-table or can live in `metadata` given expected list sizes.

---

### 3. Quick capture

The most important missing surface. Needs to be available everywhere — not a page you navigate to.

**Implementations:**
- **Global hotkey** (configurable, default `/` or `N`) — opens a floating capture modal from any screen
- **Capture modal** — single input with a type selector (Note / List / Task / Project)
- Defaults to Note; if the input looks like a list (multiple lines, dashes, bullets) it suggests List
- Can assign to a project or leave standalone
- Dismisses back to wherever the user was

**Design principle:** capture first, structure later. No required fields. Press Enter to save.

---

### 4. AI plan generator

The conversion engine. Accepts freeform input and returns a structured output.

**Entry points:**
- "Turn into plan" on any Note
- A dedicated "Plan something" card on the home/notes page
- From the new project creation flow: "Describe what you're planning" textarea → AI generates milestones + tasks

**What it produces:**
- Project title
- Category suggestion
- 3–6 milestone blocks with suggested lane names
- Task list per milestone
- Suggested duration (durationDays)
- Optional: participant role slots (e.g. "you'll probably need a cleaner and a van")

**Implementation:**
- Edge function: `supabase/functions/generate-plan/index.ts`
- Calls Claude API with the note/description as input
- Returns structured JSON matching `TemplatePayload` shape
- SPA previews the plan before creating — user can edit titles, remove items, adjust dates
- On confirm: calls `createProjectFromTemplate` with the generated payload

**Prompt design (edge function):**
```
Given this idea or note: "{input}"

Return a JSON project plan with:
- title: short project title
- category: one of [Moving, Home, Events, Career, Travel, Health, Finance, General]
- durationDays: estimated total days
- milestones: array of { title, offsetDays, durationDays, lane }
- tasks: array of { title, offsetDays }

Rules:
- milestones should be phases, not individual actions
- tasks should be concrete single actions
- offsetDays are relative to project start (day 0)
- lanes group related milestones (Planning, Bookings, Coordination, etc.)
- keep it practical and concise — 3-5 milestones, 5-10 tasks
```

---

### 5. Home / personal workspace screen

Currently the app lands on the social feed (`/app/messages`) after login. That is correct for a social-first app but wrong for a personal productivity tool.

**New home screen:** `/app/home` or `/app/workspace`

Sections:
1. **Quick capture bar** — always at the top
2. **Pinned notes** — shows pinned notes as cards
3. **Active projects** — 3–4 most recently active projects
4. **Today** — tasks due today + calendar events today
5. **Recent notes** — last few notes modified

**Onboarding consideration:** After the first login, surface this screen instead of (or as well as) the feed. Let the user's first action be capturing something, not reading a timeline.

---

## Navigation changes

The current nav structure (Messages, Coordination, Calendar, Gantt, Projects, Marketplace, Wallet) is commerce/coordination-first. Add the personal core:

**New nav items (personal mode):**
- Notes (replaces or sits above Messages in personal mode)
- Lists (can merge with Notes as a tab)
- Home / Workspace (new landing)

**Business mode nav:** unchanged — Jobs, Marketplace, Wallet remain primary.

**Nav principle:** personal mode users should reach Notes and Lists in one tap. Projects and Calendar are one tap away. Marketplace and Wallet are discoverable but not primary.

---

## Data model summary

| What | Change |
|---|---|
| `notes` table | New — see schema above |
| `coordination_objects.display_kind` | Add `'list'` value to check constraint |
| `project_shell` tabs | Add `Notes` tab |
| Edge function `generate-plan` | New — AI plan generation |
| Router | Add `/app/notes`, `/app/home` routes |
| Nav | Add Notes, Home items |

No changes to projects, milestones, tasks, coordination, marketplace, or wallet tables.

---

## Dogfooding milestones

These are the three questions to ask each week as this is built:

### Milestone 1 — Can I replace Keep / Apple Notes?
- Fast note creation ✓
- Edit and save ✓
- Find a note later ✓
- Pin important notes ✓
- Attach a note to a project ✓

### Milestone 2 — Can I go from idea to dated plan without leaving?
- Type a rough idea ✓
- AI generates a structured plan ✓
- Review and confirm ✓
- Land in a project with milestones and tasks ✓

### Milestone 3 — Can I coordinate one real thing with another person from inside it?
- Project with a note, tasks, timeline ✓
- Invite a person ✓
- Converse inside the project ✓
- Attach a service or cost if needed ✓

Milestones 2 and 3 are already possible with the existing app. Milestone 1 is the gap.

---

## Build order

```
Phase 1 — Personal core (enables daily use solo)
  1.  Migration: notes table
  2.  Lib: createNote, updateNote, deleteNote, fetchNotes, searchNotes
  3.  Page: /app/notes (list + editor)
  4.  Component: NoteCard (pin, tag, convert actions)
  5.  Project shell: Notes tab (notes filtered to project)
  6.  Global quick capture modal (hotkey + floating button)
  7.  Nav: add Notes item

Phase 2 — Lists (enables frictionless daily capture)
  8.  Coordination object display_kind: 'list'
  9.  Page: /app/lists (or Notes tab toggle)
  10. List item model (metadata.items array or sub-table)
  11. Convert list item → task
  12. Move list → project

Phase 3 — AI plan generator (enables idea-to-execution)
  13. Edge function: generate-plan (Claude API)
  14. Component: PlanPreview (editable before confirming)
  15. Entry points: Note → Turn into plan, new project flow

Phase 4 — Home screen (makes the app feel like a base)
  16. Page: /app/home
  17. Update post-login redirect for new users
  18. Pinned notes, active projects, today view

Phase 5 — Conversion polish
  19. Note → Project (one-click)
  20. Checklist item → Task promotion
  21. Note with dates → timeline suggestion
```

---

## What to explicitly not build yet

- Enterprise features (SSO, audit logs, permissions hierarchy)
- Social discovery features (trending, hashtag pages)
- Deeper marketplace (more listing types, seller analytics)
- Dependency chains on the Gantt
- Resource / workload planning

Those belong in a later phase once the personal core is genuinely usable daily. Build the base layer that makes someone open the app every morning before adding more surface area.

---

## The positioning test

When this phase is complete, the product should be describable as:

> **"It's where I keep my notes, plans, and projects — and when something needs other people or money involved, it handles that too."**

Not: "It's a social app." Not: "It's a marketplace." Not: "It's a project management tool."

The personal core is what earns the right to the rest.
