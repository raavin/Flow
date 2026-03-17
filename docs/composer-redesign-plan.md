# Composer Redesign Plan
**Date:** 2026-03-17
**Scope:** Upgrade the post/note composer across all surfaces (feed, project conversation)

---

## Design reference
Designed in Pencil — modal layout with header, formatting toolbar, large textarea, project live search, kind+visibility row, media row. No Cancel/Publish buttons — Private and Public replace them as the primary actions.

---

## Changes summary

| # | Change | Priority |
|---|---|---|
| 1 | "Update" → "Note" in kind buttons | Must |
| 2 | Formatting toolbar (B, I, H, list, checklist, link) | Must |
| 3 | Textarea much taller (min 220px, grows with content) | Must |
| 4 | Remove Cancel + Publish, replace with Private + Public buttons | Must |
| 5 | First-time confirmation on Private and Public (one-shot) | Must |
| 6 | Private saves as `visibility='private'`; Public posts as `visibility='public'` | Must |
| 7 | Filter in feed/conversation to show only notes | Must |
| 8 | Posts marked with a Private / Public badge | Must |
| 9 | Project dropdown → live search | Must |
| 10 | Multiple images (already exists) + video + audio media | Must |
| 11 | Inline editing of notes after posting | Lower |

---

## 1 — Rename "Update" → "Note"

In `apps/web/src/pages/messages.tsx`, the content kind button row has `Update`, `Product`, `Opinion`, `Fact claim`. Change the first button label and value from `update` → `note`.

`content_kind = 'note'` must be added to the DB check constraint on `posts.content_kind`.

**Migration:** `supabase/migrations/20260317100000_posts_note_kind.sql`
```sql
alter table public.posts
  drop constraint if exists posts_content_kind_check;
alter table public.posts
  add constraint posts_content_kind_check
    check (content_kind in ('note','text','link','image','video','review','product','opinion','fact_claim'));
```

---

## 2 — Formatting toolbar

### Approach: markdown in textarea
Keep the existing `<textarea>`. Add a toolbar row above it with buttons that wrap selected text in markdown syntax. Store markdown in `posts.body`. Render markdown when displaying posts.

**Why markdown over contenteditable/rich text editor:**
- Zero new dependencies
- Body is already plain text — backwards compatible
- Lightweight renderer (use `marked` or write a ~30-line mini renderer)
- Reversible — can upgrade to full rich text later without migration

### Toolbar buttons

| Button | Action | Markdown output |
|---|---|---|
| **B** | Wrap selection | `**selected**` |
| *I* | Wrap selection | `*selected*` |
| H | Prepend to line | `## line` |
| ≡ | Prepend to line | `- line` |
| ☑ | Prepend to line | `- [ ] line` |
| ⌘K | Wrap + prompt for URL | `[selected](url)` |

### Helper function: `applyMarkdownFormat(textarea, format)`
```typescript
function applyMarkdownFormat(
  ref: HTMLTextAreaElement,
  format: 'bold' | 'italic' | 'heading' | 'list' | 'checklist' | 'link',
  setValue: (v: string) => void
)
```
Reads `selectionStart`/`selectionEnd`, mutates the string, calls `setValue`, restores cursor position.

### Markdown rendering for display
Add a `renderMarkdown(body: string): string` utility in `apps/web/src/lib/social.ts`:
- Handles `**bold**`, `*italic*`, `## heading`, `- list`, `- [ ] checklist`, `[text](url)`
- Returns sanitised HTML string
- Posts rendered via `dangerouslySetInnerHTML` with the rendered output
- Only applied to posts where `content_kind = 'note'` or body contains markdown markers — plain posts render as before

Check if `marked` is already a dependency; if not, write a minimal 40-line parser to avoid adding a package.

---

## 3 — Taller textarea

Change the `<textarea>` or its wrapper:
- `min-height: 220px` (was ~80px)
- `resize: none` with auto-grow: listen to `input` event, set `height = 'auto'` then `height = scrollHeight` so it expands as the user types
- Max height: uncapped (modal scrolls if needed) or cap at `480px` with internal scroll

---

## 4 — Replace Cancel + Publish with Private + Public

Remove the `Cancel` and `Publish` buttons from the composer footer.

Add two buttons to the **right side of the kind-buttons row**:

```
[ Note ] [ Product ] [ Opinion ] [ Fact claim ]  |  [ 🔒 Private ]  [ ◎ Publish ]
```

**Private** button:
- Sets `visibility = 'private'`
- Calls the existing submit/publish mutation
- Post saved; modal closes
- Badge shown on the post: small `🔒 Private` pill

**Publish** button (was Public):
- Sets `visibility = 'public'`
- Same mutation
- Badge shown: small `◎ Public` pill

Both buttons are disabled while the mutation is pending.

---

## 5 — First-time confirmation

On the **first** click of Private or Public, show an inline confirmation banner above the buttons instead of immediately submitting:

```
┌─────────────────────────────────────────────────────────┐
│ 🔒 This will save privately — only you can see it.      │
│                              [ Cancel ]  [ Save note ]  │
└─────────────────────────────────────────────────────────┘
```

On second click (or after "Save note" confirm) → submits normally, never shows again.

**Implementation:** `localStorage.getItem('composer_confirmed_private')` / `'composer_confirmed_public'`. Set on first confirm. Subsequent clicks skip straight to submit.

---

## 6 — visibility='private' and filtering

### Saving private posts
`visibility = 'private'` already exists in the RLS policy. Posts with `visibility = 'private'` are only returned when `profile_id = auth.uid()`. No schema change needed.

### Filter in feed/conversation
Add a `Notes only` toggle button to the feed toolbar (alongside the existing Following/All toggle):

```
[ Following ]  [ All ]  [ Notes only ]
```

When active: `filter(post => post.visibility === 'private' || post.content_kind === 'note')`

Applied client-side on the existing query data — no extra DB query needed.

### Visual badge on posts
For posts where `visibility === 'private'`:
- Show a small `🔒 Private` pill in muted grey alongside the existing `Project ·` pill
For posts where `content_kind === 'note'`:
- Show a small `📝 Note` pill

---

## 7 — Project live search

Replace the `<AppSelect>` project dropdown with a live search input:

```
[ ⌕  Search or link a project… ]
```

**Behaviour:**
- On focus: shows a dropdown list of all projects (fetched from existing `projectsQuery`)
- On type: filters projects by title (client-side, no extra fetch needed — project list is already loaded)
- On select: sets `projectId` state, shows the selected project as a pill with an × to remove
- No project selected: field shows placeholder, `projectId = ''`

**Component:** Inline in the composer, no new component file needed.

---

## 8 — Media: video + audio

### Existing
Images: already implemented via `uploadPostImages` / `getSignedPostImageUrls`.

### New: Video
Two modes:
- **File upload:** `<input type="file" accept="video/*">` → upload to Supabase storage bucket `post-media`, store path in `posts.media_paths` (already a `text[]` column)
- **Link:** paste/type a URL → stored as a text entry in `media_paths` prefixed with `video:` e.g. `video:https://youtube.com/...`

Display: if `media_paths` contains a `video:` entry, render an `<video>` tag or a YouTube embed depending on URL pattern.

### New: Audio
Same pattern:
- File upload: `<input type="file" accept="audio/*">` → `post-media` bucket
- Link: `audio:https://...`
- Display: `<audio controls>` element

### Media row in composer
Three buttons: **Images**, **Video**, **Audio** — each opens its respective file picker or a small URL input popover.
Previews shown inline below the textarea before submitting (same as existing image previews).

### Storage
Use the existing `post-media` storage bucket (or create if it doesn't exist). File naming: `{userId}/{postId}/{filename}`.

---

## 9 — Inline note editing (lower priority)

For posts where `content_kind = 'note'` and `profile_id = session.user.id`:
- Show a small `✏ Edit` action in the post action row
- Clicking replaces the post body with an inline editable textarea pre-filled with the current body
- Save via `updatePost(postId, { body: newBody })`
- Cancel restores original display

The existing `updatePost` function in `social.ts` supports body updates. Only the UI affordance is missing.

---

## Files to change

| File | Change |
|---|---|
| `supabase/migrations/20260317100000_posts_note_kind.sql` | Add `note` to content_kind constraint |
| `apps/web/src/pages/messages.tsx` | Composer: toolbar, taller textarea, kind rename, Private/Public buttons, first-time confirm, project live search, media additions, Notes filter toggle, private/note badges on posts |
| `apps/web/src/lib/social.ts` | `renderMarkdown()` utility, `applyMarkdownFormat()` helper |
| `apps/web/src/lib/message-media.ts` | Extend `uploadPostImages` → `uploadPostMedia` to handle video/audio file types |

No new pages, no new routes, no new components (all inline in messages.tsx).

---

## Build order

```
1. Migration: add 'note' to content_kind constraint
2. Rename Update → Note in kind buttons
3. Taller auto-growing textarea
4. Remove Cancel/Publish, add Private/Public buttons
5. First-time confirmation (localStorage)
6. Notes-only filter toggle in feed toolbar
7. Private/Note badges on posts
8. Formatting toolbar + applyMarkdownFormat helper
9. renderMarkdown utility + apply to note posts in display
10. Project dropdown → live search
11. Video media (file + link)
12. Audio media (file + link)
13. Inline note editing
```
