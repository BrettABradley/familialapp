

## Plan: Fix Create Event dialog for mobile keyboard

### Approach
Make the `DialogContent` component mobile-keyboard-aware by adding a mobile-specific variant, and fix the Events create/edit dialogs specifically. The Messages page dialogs will NOT be touched — they already work correctly with their portal-based architecture.

### Changes

#### 1. Update `src/components/ui/dialog.tsx` — mobile-friendly DialogContent
- On small screens (`max-sm:`), change positioning from centered (`top-50% translate-y-[-50%]`) to **top-anchored with full height**: `inset-0` with `overflow-y-auto`
- This means when the keyboard opens and shrinks the viewport (`100dvh`), the dialog content naturally adjusts
- Keep the existing centered positioning for `sm:` and up (desktop unaffected)
- Make the default close button `sticky top-0 z-10` with a larger 44x44px touch target so it never scrolls away
- Keep all existing exports and API — no breaking changes

#### 2. Update `src/pages/Events.tsx` — red trash discard button + scroll-into-view
- **Create dialog**: Hide the default X via `[&>button:last-child]:hidden` on `DialogContent`, add a custom red `Trash2` icon button in the `DialogHeader` that calls `setIsCreateOpen(false)` with reset
- **Edit dialog**: Same treatment — red `Trash2` to discard/close
- **Move Description field** above Photo Album so it's higher in the scroll order
- **Add `onFocus` scroll-into-view** to Description `Textarea` and Location `Input`: `onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}` (300ms delay lets the keyboard finish opening)

#### 3. What stays untouched
- **`src/pages/Messages.tsx`** — all message dialogs (edit group, view members, create group) use simple short forms that don't have this problem. The DM/group chat portal architecture is completely separate and won't be affected.
- The `DialogContent` changes are purely CSS responsive — mobile-only layout shift, desktop stays identical.

### Files to modify
- `src/components/ui/dialog.tsx` — mobile-responsive positioning, sticky close button
- `src/pages/Events.tsx` — red Trash2 discard button, Description field reorder, onFocus scroll-into-view

