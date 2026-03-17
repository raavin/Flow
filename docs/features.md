# Superapp — Feature Reference

_A plain-English inventory of everything the app does today. Use this as a baseline for ideation._

---

## Table of Contents

1. [Auth & Onboarding](#1-auth--onboarding)
2. [Navigation & Layout](#2-navigation--layout)
3. [Projects](#3-projects)
4. [Messages & Social Feed](#4-messages--social-feed)
5. [Coordination (Flows)](#5-coordination-flows)
6. [Gantt Timeline](#6-gantt-timeline)
7. [Calendar](#7-calendar)
8. [Marketplace](#8-marketplace)
9. [Wallet & Transactions](#9-wallet--transactions)
10. [Jobs Board](#10-jobs-board)
11. [Participants](#11-participants)
12. [Planning Tools](#12-planning-tools)
13. [Notifications](#13-notifications)
14. [AI Assistant](#14-ai-assistant)
15. [Integrations](#15-integrations)
16. [Settings & Profile](#16-settings--profile)
17. [Support](#17-support)
18. [Data Model Summary](#18-data-model-summary)

---

## 1. Auth & Onboarding

### Sign-up / Sign-in
- Email + password auth via Supabase
- Toggle between "Create account" and "Sign in" modes on the landing page
- On sign-in, session is checked: redirects to onboarding if profile incomplete, otherwise to the feed

### Onboarding wizard
Steps saved progressively to `profiles` and `business_profiles`:

| Step | Fields |
|------|--------|
| Account type | Individual / Business / Both |
| Personal info | First name, last name, location, time zone |
| Handle | Auto-generated from name; 3–30 chars, alphanumeric + `_-.` |
| Use cases | Multi-select: moving house, birthdays, travel, weddings, family scheduling, etc. |
| Integration preferences | Calendar, contacts, notifications, payments (toggles) |
| Business info _(if Business or Both)_ | Business name, category, service area, offerings, booking model, availability notes, visibility |

---

## 2. Navigation & Layout

### Sidebar / nav
- **Feed** — social messages
- **Calendar** — personal + project events
- **Timeline** — Gantt across all projects
- **Projects** — project spaces
- **Marketplace** — browse, buy, sell
- **Wallet** — transactions ledger
- **Jobs** — jobs board _(business mode)_
- **Integrations** — connected services
- **AI** — assistant
- **Search** — global search
- **Notifications** — activity feed
- **Support** — help articles
- **Settings / Profile**
- **Sign out**

### Mode switching
- Profiles with `account_mode = 'both'` can toggle between Personal and Business modes
- Active mode changes which features and data are surfaced

### Themes
- Four themes: Quirky, Clean, Flow, Mono
- Cycled via a button; persisted in `localStorage` and applied as a class on `<html>`

---

## 3. Projects

### Project list
- Create a project with a title; category and target date are optional at creation
- Each project card shows: title, category, target date, status
- Double-click inline editing for title and category
- Status: Active → Upcoming → Completed (cycle toggle)
- Delete with two-step confirmation

### Project shell (tabs)
Every project opens into a tabbed shell:

| Tab | What it contains |
|-----|-----------------|
| **Conversation** | Social-style post feed scoped to the project |
| **Calendar** | Events linked to this project |
| **Timeline** | Gantt chart (milestones + tasks) for this project |
| **Store** | Marketplace listings linked to this project |
| **People** | Participants in this project |

The shell header always shows: project title (double-click to edit), category, target date, status, and delete/back controls.

### Project conversation
- Full feed composer and post list scoped to the project
- Posts can be promoted to the public feed (globe icon → "Promote to feed")
- Promoted posts show a **Public** badge; can be demoted back

### Project store tab
- Lists all marketplace listings linked to this project
- Toggle publish / draft per listing
- "New listing" navigates to the listing editor with this project pre-selected

### Notes
- Create notes with a title and body
- Inline editing (double-click to rename)
- Delete with confirmation
- _(Navigation lives at `/projects/$id/notes` as a legacy route — currently not in the main tab bar)_

---

## 4. Messages & Social Feed

### Feed modes
| Mode | Shows |
|------|-------|
| **Following** | Posts from people you follow |
| **Discover** | All public posts |
| **Bookmarks** | Posts you've saved |

### Composing posts
- Text with inline `@mention`, `#hashtag`, and `/command` autocomplete
- Attach up to 4 images (uploaded to Supabase Storage)
- Link post to a project (dropdown)
- Add supporting links (1–2 URLs)
- Set content kind: general, announcement, review, commerce, media, update, mislabel

### Post interactions
| Action | Who |
|--------|-----|
| Like | Anyone |
| Repost | Anyone |
| Quote | Anyone (opens composer with quoted post embedded) |
| Bookmark / Save | Anyone |
| Reply | Anyone (opens post detail thread) |
| Share | Anyone (copies link to clipboard) |
| Direct message to author | Anyone (not own posts) |
| Edit | Post owner |
| Delete | Post owner |
| Promote to public feed | Post owner (project-linked posts only) |
| Flag / mislabel | Anyone (reports content kind) |

### Post detail
- Full post with all replies in a thread
- Same interaction buttons

### Social profiles
- View any user's profile at `/app/messages/profile/$handle`
- Shows: display name, handle, bio, follower/following counts, post list
- Follow / Unfollow button
- Message button → opens a DM thread

### Topics
- Posts can be tagged with `#topics`
- Browse a topic page to see all posts under that tag
- Subscribe / unsubscribe to topics

### Direct messages
- Inbox lists all DM threads
- Thread view: message history with timestamps, image support
- Compose new thread from a profile page (Message button) or DM inbox

### Search
- Full-text search across posts, people, and topics
- Results grouped by type

---

## 5. Coordination (Flows)

Coordination is the app's central "life operating system" — a universal inbox for anything that needs to happen, from reminders to complex multi-step workflows.

### Quick capture form
Fields:

| Field | Options |
|-------|---------|
| Title | Free text |
| Intent | Coordinate, Remind, Ask, Book, Buy, Attend, Celebrate, Health, Work, Support |
| Display kind | Task, Event, Reminder, Booking, Purchase, Plan, Workflow, Project |
| Timing | Start date + end/due date (optional) |
| Note | Supporting context |
| Participants | Comma-separated names |
| Project link | Connect to an existing project |

### Board view
Items are grouped into swim lanes based on state:

| Lane | Items shown |
|------|-------------|
| **Now** | Active state, or due today |
| **Next** | Scheduled / upcoming |
| **Backlog** | Draft, pending, or no time attached |
| **Done** | Completed |

### Per-item actions
- Double-click to rename inline
- State transitions: Mark active → Mark complete → Archive
- Delete with two-step confirmation
- Open detail page

### Flow detail page
- Full view: title, summary, display kind, intent, state (pills)
- **Participants**: Add from the people directory by @handle
- **Project link**: Convert the flow into a standalone project if not already linked
- **Source post**: If this flow was created from a post, shows the original
- **Thread**: Dedicated message conversation for this flow (separate from the main feed)

### Reusable flow templates
- Browse saved templates showing title, block count, and first 4 blocks
- **Apply a template**: Choose an anchor date → system creates the parent flow + all child blocks with their relative date offsets and dependencies
- **Create a template**: Title, summary, display kind, and a JSON block array defining the steps
- **Rename / delete** templates
- **Seed starter templates**: One-click to load 3 built-in patterns (birthday prep, doctor appointment, weekend move)

---

## 6. Gantt Timeline

An interactive drag-and-drop timeline. Accessible standalone at `/app/gantt` or embedded in the Timeline tab of any project.

### Two modes

| Mode | Shows |
|------|-------|
| **Project** | Milestones and tasks for one selected project |
| **Coordination** | All timed coordination objects across all projects |

### Zoom levels
Detail · Comfortable · Overview · Strategic (cell width ranges from 54 → 14 px per day)

### Navigation
- Back / Today / Forward buttons scroll the timeline
- Today is marked with a vertical red line and label
- Sticky label column stays visible while scrolling horizontally

### Row interactions
- **Drag to move** — shifts the entire date range
- **Drag start/end handles** — resizes range items (milestones, coordination blocks)
- **Double-click label** — inline title editing (all item types including coordination)
- **Pencil icon** — appears on hover, triggers same inline edit
- **Trash icon** — appears on hover, delete with Yes/No confirmation

### Coordination mode extras
- Each row shows the linked **project name** in teal as a prefix to the kind label
- **Search bar** — live filter by title or project name
- **Project dropdown** — filter to one project (only shows projects with timed items)
- **Kind dropdown** — filter by display kind (only shows kinds present in data)
- **Clear filters** button when any filter is active
- Empty-state message with Clear filters button when filters match nothing

### Adding items (project mode only)
- **Add block** (milestone): title, start date, end date, lane name
- **Add task**: title, due date

### Seed milestones
New projects automatically get three milestones: **Kickoff**, **Mid-point review**, **Delivery** (spaced 30 days apart from the project target date).

---

## 7. Calendar

### Views
Month · Week · Day · Agenda

### Events
- Create / edit / delete events
- All-day vs timed (draggable time range)
- 8 colour presets
- Recurring events via RRule (daily, weekly, monthly, yearly + custom)
- Exceptions to recurring series

### Scoped views
- Global calendar shows all events
- Project calendar tab shows events linked to that project only

### Coordination sync
- Events created in the calendar are mirrored as coordination objects
- Changes to coordination object timing propagate back

---

## 8. Marketplace

### Browse
- Unified grid of all published listings
- **Filters**: All · Templates · Services · Products
- **Sort**: Newest · Top rated · Price low→high · Price high→low
- **Listing card**: image, title, seller, star rating + review count, price, View details link, Add to cart button

### Listing detail
- Image gallery with previous/next navigation
- Full description, category, kind badge, price
- Seller name links to seller profile page
- **Ratings summary**: average stars + distribution
- **Reviews list**: each shows author, star rating, body, date, and seller reply (if any)
- **Leave a review** button _(appears if you've purchased this listing)_
- **Add to cart** — quantity, optional project attachment
- **Import template** _(template listings only)_ — creates a project from the template immediately
- **Attach to project** _(if navigated from within a project)_
- **Cart** count shown, link to cart

### Shopping cart
- Draft order with all items
- Per-item: adjust quantity, link to a project, add a booking date and note, remove
- Order summary: subtotal, tax, total
- **Place order** → creates a `commerce_order` and `financial_transaction` records for buyer and seller
- Post-checkout screen: order reference number, links to wallet and to continue shopping

### Seller tools — listing management
- Create, edit, duplicate, delete listings
- Fields: title, summary, kind, category, price label, whimsical note, SKU, tax rate, fulfillment notes, workspace project link
- Image management: upload, set cover, reorder, delete
- Publish / unpublish toggle
- View listing stats: review count, rating, purchase count
- Respond to customer reviews

### Seller profile
- Public page at `/app/marketplace/seller/$id`
- Shows all published listings from that seller

---

## 9. Wallet & Transactions

### Transaction types
| Type | Created by |
|------|-----------|
| Marketplace order | Placing a cart order |
| Transfer | Manual P2P money movement |
| Request | Ask another user for money |
| Manual entry | Log any custom transaction |
| Payout | Shift completion via Shiftly API |

### Ledger view
Columns: Date · Description · Counterparty · Tags · Product · Linked work · Subtotal · Tax · Fee · **Total** (signed: +$inbound / -$outbound) · Net · Status · Reference

**Filters**:
- All · Pending · Marketplace · Project-linked · Sales
- Project filter dropdown

**Actions per row** (where applicable):
- Mark settled (pending → paid)
- Inline edit description or amount (manual entries)
- Delete (manual entries)

### Summary cards
- Pending in · Pending out · Marketplace spend · Net position

---

## 10. Jobs Board

_Business mode feature._

### Job list
- Create a job: title, customer name, status, payment state, optional project link
- Each job row: title (double-click rename), customer (double-click rename), status, payment state, status action buttons, delete

### Status
Today · Upcoming · Waiting on customer · Delayed · Completed

### Payment state
Unpaid · Deposit due · Paid

### Job detail tabs

| Tab | Contents |
|-----|----------|
| **Overview** | Appointment date/time, internal notes, quick status buttons |
| **Workflow** | Ordered steps with title, status (todo/doing/done), visibility (customer-facing or internal). Double-click to rename, status buttons, visibility toggle, delete |
| **Payment** | Payment state buttons, request payment amount input (creates a wallet request entry) |
| **Updates** | Structured update composer (if linked to a project); feed of recent updates from that project |

---

## 11. Participants

Attached to projects at `/projects/$id/participants`.

### Invite
- Name or business name
- Kind: Person or Business/provider
- Role: Owner · Collaborator · Helper · Guest · Provider · Viewer
- Contact hint (email / phone / username)
- Optional note
- Duplicate name prevention with inline error message

### Manage
- Double-click name to rename inline
- Inline role select (changes immediately)
- Status buttons: Invited · Active · Declined
- Remove with Yes/No confirmation
- Availability status pill (shown when set)

---

## 12. Planning Tools

### Availability
- View participant availability
- Propose meeting slots with "best slot" recommendation

### Budget
- Set budget target, estimated, actual, and outstanding amounts
- Add line items: category, estimate, actual
- Calculated totals per category, overall summary
- Double-click inline editing on line item titles and categories

### Structured Updates
- Post a typed update to a project: Delay · Confirmed · Completed · Unavailable · Payment sent · Booking changed · etc.
- Select affected milestone
- Previous / next time, narrative note, AI replan toggle
- Impact preview before sending
- Chronological update feed

---

## 13. Notifications

- List of all activity notifications with title, body, kind (projects / wallet / jobs), and optional deep-link
- Unread indicator
- Mark as read per notification
- Sources: project activity, wallet movements, job updates, social interactions

---

## 14. AI Assistant

- Prompt textarea with example suggestion chips: _Plan something, Optimise schedule, Draft a message, Estimate costs, Suggest providers, What am I missing_
- Optional project context selector
- **AI Action cards**: Each suggestion has a title, detail, and type
  - **Accept** — creates the suggested object (task, event, etc.)
  - **Ignore** — dismisses with status tracking
- Action history: Open · Accepted · Ignored

---

## 15. Integrations

### Payment providers
| Provider | Connection method |
|----------|------------------|
| Stripe | OAuth (Stripe Connect) |
| PayPal | OAuth |
| OpenWallex | OAuth |
| Direct Banking | Secure form (BSB + account — stored in vault, never in DB) |

Each shows: connection status, connected account label, Connect/Disconnect button.

### Accounting
| Provider | Features |
|----------|---------|
| Xero | OAuth, last sync timestamp, Sync now button |
| MYOB | OAuth, last sync timestamp, Sync now button |

Sync maps `financial_transactions` → Xero invoices/bills or MYOB journal entries. Idempotent via `external_sync_ids` JSON column.

### Shiftly (staff scheduling integration)
- Dedicated panel with pre-scoped API key creation (`orders:read`, `schedules:read`, `shifts:write`)
- Webhook endpoint form pre-configured for Shiftly event types
- API documentation link

### Developer API
- **API keys**: Create (name + scope checkboxes), list (prefix + last used — never full key), revoke
  - Raw key shown **once** on creation with copy button
  - Format: `sa_live_<base64url(32 bytes)>`
  - Stored as SHA-256 hash only
- **Webhook endpoints**: URL, description, event type subscriptions, pause/enable, delete
  - Each endpoint has a per-endpoint HMAC signing secret (stored in vault)
  - Delivery log modal: event type, status (delivered / pending / abandoned), HTTP response, timestamp

---

## 16. Settings & Profile

### Personal profile
- First name, last name, location, time zone
- Handle (@username) with availability validation
- Bio
- Integration preference toggles

### Business profile
- Business name, category, service area
- Offering types, booking model, availability notes, visibility mode

---

## 17. Support

- Searchable help articles
- Each article: title, summary, body, tags
- Optional deep link to the relevant app route
- Full-text search across title, summary, and body

---

## 18. Data Model Summary

### Core tables

| Table | Purpose |
|-------|---------|
| `profiles` | User identity, handle, bio, account_mode, active_mode, integrations |
| `business_profiles` | Business name, category, offerings, booking model |
| `social_profiles` | Handle, display name, bio, follower/following counts |
| `social_follows` | Follow relationships |
| `posts` | Feed posts with body, visibility, linked_project_id, is_promoted, engagement counts |
| `post_engagements` | Likes, reposts, bookmarks per user per post |
| `direct_message_threads` | DM conversations |
| `direct_messages` | Messages within DM threads |
| `projects` | Title, category, target_date, status, budget_cents |
| `project_participants` | Name, role, status, contact_hint, note (unique per project + name) |
| `project_notes` | Title, body |
| `milestones` | Project timeline blocks with start/end dates and lane |
| `tasks` | Project tasks with due_on date |
| `calendar_events` | Events with optional recurrence (RRule), colour, all-day flag |
| `coordination_objects` | Universal flow objects: kind, display_kind, intent, state, time window, participants |
| `coordination_templates` | Reusable flow definitions with JSON block array |
| `coordination_messages` | Thread messages scoped to a flow |
| `coordination_participants` | People attached to a coordination object |
| `marketplace_listings` | Products, services, and templates for sale |
| `listing_images` | Images linked to listings |
| `marketplace_reviews` | Star ratings and text reviews on listings |
| `cart_items` | Shopping cart (draft, pending checkout) |
| `commerce_orders` | Placed orders from cart |
| `financial_transactions` | Full double-entry-style ledger for all money movement |
| `connected_integrations` | OAuth tokens (vault refs), provider account IDs |
| `integration_api_keys` | Developer API keys (prefix + SHA-256 hash) |
| `webhook_endpoints` | Outbound webhook subscriber URLs |
| `webhook_deliveries` | Delivery log with retry state |
| `jobs` | Business jobs with status, payment state |
| `job_workflow_steps` | Ordered steps within a job |
| `notifications` | Activity notifications per user |

### Key enumerations

| Enum | Values |
|------|--------|
| `AccountMode` | individual · business · both |
| `CoordinationObjectKind` | message · event · reminder · task · booking · purchase · request · plan · project · workflow · job · listing · template |
| `CoordinationDisplayKind` | task · event · reminder · booking · purchase · plan · workflow · project |
| `CoordinationObjectIntent` | coordinate · remind · ask · book · buy · attend · celebrate · health · work · support |
| `CoordinationObjectState` | draft · pending · scheduled · active · blocked · completed · cancelled · archived |
| `ProjectStatus` | active · upcoming · completed |
| `MarketplaceKind` | template · service · product |
| `TransactionDirection` | in · out |
| `TransactionType` | transfer · request · marketplace · manual · payout |
| `IntegrationProvider` | stripe · paypal · openwallex · direct_banking · xero · myob · shiftly · generic |
