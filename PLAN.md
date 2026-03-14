# Flow Fix Implementation Plan

## Status Legend
- [ ] Pending
- [x] Complete

---

## High Priority

- [x] **1. DB migration** — add `link_url` to notifications table
- [x] **2. lib/search.ts** — add `kind` discriminator to search results
- [x] **3. lib/coordination.ts** — add `linkUrl` to `createNotification`, update all call sites
- [x] **4. pages/tools.tsx** — make search results clickable (route by kind)
- [x] **5. pages/tools.tsx** — cart checkout confirmation panel + wallet link

## Medium Priority

- [x] **6. pages/notifications.tsx** — render `link_url` as clickable link
- [x] **7. pages/coordination.tsx** — link to linked project; auto-navigate after template apply
- [x] **8. pages/jobs.tsx** — add listing creation path for business users

## Low Priority

- [x] **9. pages/listings.tsx + messages.tsx** — breadcrumb back-links on detail pages
- [x] **10. pages/wallet.tsx** — highlight transaction on arrival from cart

---

## All tasks complete ✓

---

## Theme system (branch: design/clean-modern-theme)

- [x] Restructured `packages/ui/src/theme.css` — both themes defined via `[data-theme]` selectors
- [x] `apps/web/tailwind.config.ts` — `bg-sprinkles` and `rounded-button` now use CSS vars
- [x] `apps/web/src/components/layout.tsx` — theme toggle (Palette icon, persisted to localStorage)

**To switch theme:** click the palette icon in the sidebar, or set `data-theme="clean"` / `data-theme="quirky"` on `<html>`.
