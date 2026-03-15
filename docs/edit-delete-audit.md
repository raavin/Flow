# Edit / Delete Audit — Missing UI & Lib Gaps

**Date:** 2026-03-15
**Scope:** All pages under `/app/*`

---

## Summary

Most creation flows exist. The gaps are almost entirely in the *management* side — things users created but can't rename, recategorise, or remove. Some also lack confirmation dialogs on destructive actions.

---

## Items to Implement

### 1 — Project title / category / status edit (`projects.tsx`)

**What:** The projects list shows each project with only a Delete button. There is no way to rename a project, change its category, or change its status (active / on-hold / completed) after creation.

**What exists:** `updateProject(projectId, { title, category, targetDate, status })` already exists in `lib/projects.ts` and is fully implemented — just never wired to any UI.

**UI pattern:**
- Double-click project title → transparent input inline edit (save on blur/Enter, cancel on Escape)
- Small `Pencil` hint icon on hover
- Status: add status pill/button row (same pill pattern used in jobs) inline on the project card
- Category: double-click on category text → inline input

**Lib work:** None needed.

---

### 2 — Participant remove confirmation + role/name edit (`participants.tsx`)

**What:** The participants page has a "Remove" button that executes immediately with no confirmation. Additionally there is no way to edit a participant's name, role, contact hint, or note after they have been invited.

**What exists:** `removeParticipant(participantId)` and `updateParticipant({ participantId, nextStatus, nextRole })` exist. `nextRole` is supported in `updateParticipant` already.

**UI pattern:**
- "Remove" button → two-step confirm (same pattern as jobs/gantt)
- Double-click name → inline input (uses `updateParticipant` with a name field — need to verify DB column, fallback to a separate `updateParticipantDetails` RPC if needed)
- Role: change from display text to a small `<select>` inline (owner / collaborator / helper / guest / provider / viewer)

**Lib work:** Check if `updateParticipant` accepts a `name` field; if not, add it.

---

### 3 — Coordination object title edit + delete (`coordination.tsx`)

**What:** Coordination objects (reminders, appointments, asks, tasks, bookings, flow blocks) can have their state updated and project link changed, but their **title cannot be edited** and they **cannot be deleted** from the UI at all.

**What exists:** `updateCoordinationObjectState`, `updateCoordinationObjectSchedule`, `updateCoordinationObjectProjectLink` all exist. No delete or title-update function exists.

**UI pattern:**
- Double-click object title in the coordination object list → inline input
- Small `Trash2` delete icon with two-step Yes/No confirm on each card

**Lib work (new functions needed):**
```typescript
// lib/coordination-objects.ts
export async function updateCoordinationObjectTitle(id: string, title: string): Promise<void>
export async function deleteCoordinationObject(id: string): Promise<void>
```

---

### 4 — Coordination template rename + delete (`coordination.tsx`)

**What:** Templates can be created (by pasting JSON) but there is no way to rename or delete them afterward.

**What exists:** `fetchCoordinationTemplates`, `createCoordinationTemplate`, `instantiateCoordinationTemplate`. No update or delete function exists.

**UI pattern:**
- Double-click template name → inline input
- `Trash2` delete icon with two-step confirm

**Lib work (new functions needed):**
```typescript
// lib/coordination-objects.ts
export async function updateCoordinationTemplate(id: string, name: string): Promise<void>
export async function deleteCoordinationTemplate(id: string): Promise<void>
```

---

### 5 — Workflow step title edit + delete (`business.tsx`)

**What:** Job detail workflow steps can be toggled todo/doing/done and exposed/hidden from the customer, but their **title cannot be edited** and individual **steps cannot be deleted**.

**What exists:** `updateWorkflowStep({ stepId, status?, customerVisible? })` — title is not a supported field.

**UI pattern:**
- Double-click step title → inline input (same pattern as jobs)
- `Trash2` delete icon with two-step confirm per step card

**Lib work:**
- Extend `updateWorkflowStep` to accept optional `title?: string`
- Add new function:
```typescript
export async function deleteWorkflowStep(stepId: string): Promise<void>
```

---

### 6 — Structured update delete (`planning.tsx`)

**What:** The Structured Updates sub-page shows auto-generated log entries for project timeline changes. These are read-only with no management controls at all. Editing is not appropriate (they are an audit trail), but **deleting** stale or wrong entries should be possible.

**What exists:** `fetchStructuredUpdates`. No delete function.

**UI pattern:**
- Small `Trash2` delete icon on each update row with two-step confirm (no inline edit needed)

**Lib work (new function needed):**
```typescript
// lib/projects.ts
export async function deleteStructuredUpdate(updateId: string): Promise<void>
// → supabase.from('structured_updates').delete().eq('id', updateId)
```

---

### 7 — Manual wallet entry edit (`wallet.tsx`)

**What:** Manual wallet entries (source_kind = 'manual') can be deleted but not edited. Amount, description, and direction should be editable for entries the user created manually.

**What exists:** `deleteWalletEntry(entryId)` exists. No update function.

**UI pattern:**
- For rows where `transactionRole === 'manual'`: add a `Pencil` icon button that expands an inline edit form (amount + description) or a small edit modal — a modal is more appropriate here given the numeric input
- Save updates the row; cancel discards

**Lib work (new function needed):**
```typescript
// lib/wallet.ts
export async function updateWalletEntry(
  entryId: string,
  input: { description?: string; amount_cents?: number; direction?: 'in' | 'out' }
): Promise<void>
// → supabase.from('financial_transactions').update(...).eq('id', entryId).eq('transaction_type', 'manual')
```

---

## Missing Confirmation Dialogs

These destructive actions currently execute immediately without any confirmation:

| Location | Action | Fix |
|---|---|---|
| `integrations.tsx` — Payment Providers | Disconnect | Add two-step "Disconnect [provider]?" confirm |
| `integrations.tsx` — Accounting | Disconnect | Same |
| `integrations.tsx` — Shiftly section | Revoke API key | Add confirm |
| `integrations.tsx` — Shiftly section | Remove webhook | Add confirm |

---

## Out of Scope (Intentionally Read-Only)

| Entity | Reason |
|---|---|
| Commerce order history (wallet) | Immutable financial record |
| Delivered webhook log entries | Audit trail |
| DM messages | No edit after send (by design) |
| Coordination objects in Gantt view | Edit happens in coordination.tsx |

---

## Build Order

```
1.  Lib: updateCoordinationObjectTitle + deleteCoordinationObject (coordination-objects.ts)
2.  Lib: updateCoordinationTemplate + deleteCoordinationTemplate (coordination-objects.ts)
3.  Lib: deleteWorkflowStep + extend updateWorkflowStep for title (jobs.ts)
4.  Lib: deleteStructuredUpdate (projects.ts)
5.  Lib: updateWalletEntry (wallet.ts)
6.  UI:  Project title/category/status inline edit (projects.tsx)
7.  UI:  Participant remove confirm + role/name inline edit (participants.tsx)
8.  UI:  Coordination object title edit + delete (coordination.tsx)
9.  UI:  Coordination template rename + delete (coordination.tsx)
10. UI:  Workflow step title edit + delete (business.tsx)
11. UI:  Structured update delete (planning.tsx)
12. UI:  Manual wallet entry edit modal (wallet.tsx)
13. UI:  Integrations disconnect/revoke confirmations (integrations.tsx)
```

---

## Already Complete (for reference)

| Entity | Edit | Delete |
|---|---|---|
| Jobs (title, customer name) | ✅ double-click | ✅ with confirm |
| Job status / payment state | ✅ pill buttons | — |
| Marketplace listings | ✅ full form | ✅ with confirm |
| Project notes | ✅ form re-open | ✅ with confirm |
| Milestones (Gantt) | ✅ double-click | ✅ with confirm |
| Tasks (Gantt) | ✅ double-click | ✅ with confirm |
| Budget expenses | ✅ double-click | ✅ with confirm |
| Calendar events | ✅ full form | ✅ with confirm |
| Posts | ✅ composer re-open | ✅ with confirm |
| Webhook endpoints (Dev section) | ✅ double-click | ✅ with confirm |
| Manual wallet entries | — | ✅ with confirm |
| Cart items | ✅ quantity/fields | ⚠️ no confirm |
