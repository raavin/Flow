# Coordination Timeline — Edit, Delete & Filter Plan

## Context

The Gantt page has two modes: **Project** (milestones + tasks for one project) and **Coordination** (all timed coordination objects across every project). In coordination mode three things are broken or missing:

1. **Edit titles** — the pencil icon and double-click handler are guarded behind `item.source !== 'coordination'`, so they never fire.
2. **Delete rows** — the entire delete block is guarded the same way; coordination items cannot be removed from the timeline view.
3. **No project label** — coordination items show no indication of which project they belong to, making the view unreadable when many projects are active.
4. **No filtering** — there is no way to narrow the timeline; everything is displayed at once.

All the underlying lib functions already exist:
- `updateCoordinationObjectTitle(id, title)` — in `coordination-objects.ts`
- `deleteCoordinationObject(id)` — in `coordination-objects.ts`
- `fetchProjects()` — in `projects.ts`
- `fetchCoordinationObjects({ linkedProjectId })` — already accepts a project filter

---

## Change 1 — Enable Title Editing for Coordination Items

### What's broken
`gantt.tsx` around line 559 has an early-return guard in `beginLabelEdit`:
```ts
if (item.source !== 'coordination') return   // ← blocks edit
```
The pencil icon in the label renderer is also hidden for coordination:
```ts
{item.source !== 'coordination' && <Pencil … />}
```

### Fix
- Remove the early-return guard in `beginLabelEdit`.
- Show the pencil icon for coordination items the same as for milestones/tasks.
- The `updateItemMutation` already branches on `source === 'coordination'` and calls `updateCoordinationObjectTitle()` — **no change needed there**.

### Files
- `apps/web/src/pages/gantt.tsx` — remove guard in `beginLabelEdit`, show pencil icon

---

## Change 2 — Enable Delete for Coordination Items

### What's broken
The entire delete section (trash icon, confirmation inline, `deleteItemMutation`) is inside a block that only renders for milestones and tasks.

### Current `deleteItemMutation` shape
```ts
// Only handles milestone and task; returns early for anything else
deleteItemMutation = useMutation({
  mutationFn: (id: string) => {
    const item = findItem(id)
    if (item?.source === 'milestone') return deleteMilestone(id)
    return deleteTask(id)
  }
})
```

### Fix
- Extend `deleteItemMutation.mutationFn` to add a third branch:
  ```ts
  if (item?.source === 'coordination') return deleteCoordinationObject(id)
  ```
- Remove the `item.source !== 'coordination'` guard that hides the delete UI row, OR add a separate matching row for coordination items.
- On success, invalidate `['coordination-objects', 'timeline']`.

### Files
- `apps/web/src/pages/gantt.tsx` — extend `deleteItemMutation`, remove render guard

---

## Change 3 — Show Project Label on Coordination Rows

### What's needed
Each coordination item may have a `linkedProjectId` (already present in the `CoordinationObject` type). The Gantt builds `GanttItem` from coordination objects but doesn't copy `linkedProjectId` or the project title through.

### Fix
1. In the coordination items map (around line 110–134 of gantt.tsx), copy `linkedProjectId` from each coordination object onto the `GanttItem` (needs to be added to the `GanttItem` type).
2. Look up the project title from `projectsQuery.data` (already fetched on line 67).
3. In the row renderer, show a small pill or subdued label beneath the row title:
   ```
   ● Move house          ← row title (editable)
     Move project        ← project name pill (small, muted, teal or ink/40)
   ```
   Only render the label when the item has a `linkedProjectId`. Unlinked coordination objects show nothing.

### Type change
```ts
// GanttItem (lines 22-31) — add one optional field:
linkedProjectId?: string
linkedProjectTitle?: string
```

### Files
- `apps/web/src/pages/gantt.tsx` — extend `GanttItem` type, copy fields in coordination map, add project label to row renderer

---

## Change 4 — Filtering & Search

### Requirements
- Live text search across item titles (and optionally project names)
- Filter by project (single-select dropdown — "All projects" default)
- Filter by item kind / display kind (e.g. Task, Event, Reminder, Meeting…)
- All three filters compose together (AND logic)

### Available filter data
- **Project list**: `projectsQuery.data` — already fetched
- **Display kinds** on coordination objects: `displayKind` field — values include `task`, `reminder`, `event`, `meeting`, `booking`, `plan`, `campaign`, `sprint`, `thread` (from DB enum)
- **Title**: already on every `GanttItem`

### UI placement
Filters live in the toolbar row that already has the mode toggle and zoom controls — add a new section between the mode toggle and zoom:

```
[ Project mode | Coordination mode ]  [ Search… ]  [ Project ▾ ]  [ Kind ▾ ]  [ – Zoom + ]
```

On narrow screens the filter row wraps to a second line.

### Filter state (all local — no server round-trips needed)
```ts
const [search, setSearch] = useState('')
const [filterProjectId, setFilterProjectId] = useState<string | 'all'>('all')
const [filterKind, setFilterKind] = useState<string | 'all'>('all')
```

### Filtering logic
Applied after `coordinationItems` is built, before the items array is passed to the Gantt renderer:

```ts
const visibleItems = (timelineMode === 'coordination' ? coordinationItems : projectItems)
  .filter(item => {
    if (search) {
      const q = search.toLowerCase()
      const titleMatch = item.title.toLowerCase().includes(q)
      const projectMatch = (item.linkedProjectTitle ?? '').toLowerCase().includes(q)
      if (!titleMatch && !projectMatch) return false
    }
    if (filterProjectId !== 'all' && item.linkedProjectId !== filterProjectId) return false
    if (filterKind !== 'all' && item.lane !== filterKind) return false
    return true
  })
```

### Filter dropdowns

**Project dropdown** (only shown in coordination mode):
```
All projects
──────────────
Move house
Birthday prep
Work sprint
```
Built from `projectsQuery.data`. Only shows projects that have at least one timed coordination item in the current view.

**Kind dropdown**:
```
All kinds
──────────
Task
Reminder
Event
Meeting
Plan
Sprint
```
Built dynamically from distinct `lane` values present in `coordinationItems` — so it only ever shows kinds that actually exist in the data.

### Empty state
When filters produce zero items, show a centred message:
```
No items match your filters.
[Clear filters]   ← button that resets all three
```

### Files
- `apps/web/src/pages/gantt.tsx` — add filter state, filter dropdowns to toolbar, apply filter before render

---

## Build Order

```
1. GanttItem type — add linkedProjectId + linkedProjectTitle fields
2. Coordination items map — copy linkedProjectId, resolve title from projectsQuery
3. Row renderer — add project label pill beneath title
4. beginLabelEdit — remove coordination guard
5. Pencil icon — show for coordination items
6. deleteItemMutation — add coordination branch
7. Delete UI — remove coordination guard
8. Filter state — add search, filterProjectId, filterKind
9. Toolbar — add search input + two dropdowns
10. Filter application — wire visibleItems computed value
11. Empty-state message + "Clear filters" button
```

Each step is independently testable. Steps 1–3 (project label) and 4–7 (edit/delete) can be done in parallel.

---

## Files Changed

| File | Changes |
|------|---------|
| `apps/web/src/pages/gantt.tsx` | All changes — type extension, map update, renderer, guards, mutations, toolbar, filter logic |

No new files, no migration needed, no lib changes — all the functions already exist.

---

## What Is NOT Changing

- The coordination objects board in `coordination.tsx` — already fully supports edit and delete; this plan only fixes the Gantt timeline view.
- The underlying DB schema or RLS — no changes needed.
- Project mode behaviour — project-mode rendering, edits, and deletes are untouched.
