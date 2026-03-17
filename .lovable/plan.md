

## Plan: Fix Album dialog + Event keyboard issues

### Problems
1. **Album create dialog** has no red trash discard button (unlike Events)
2. **Album create dialog** content pushed down by excess space — fields not near top
3. **Event create dialog** — Location input still gets blocked by keyboard despite `onFocus` scroll, because the Calendar takes up significant vertical space and the `scrollIntoView` may not overcome keyboard overlap within the dialog's scroll container
4. Both dialogs need the default X hidden when custom discard is used

### Changes

#### 1. `src/pages/Albums.tsx` — Add red Trash2 discard button to create dialog
- Hide default X via `[&>button:last-child]:hidden` on `DialogContent`
- Add a `DialogHeader` with flex row layout containing the title/description on left and a red `Trash2` icon button on right (matching Events pattern exactly)
- Add `onFocus` scroll-into-view to the Album Name `Input` and Description `Textarea`
- Import `Trash2` (already imported)

#### 2. `src/pages/Events.tsx` — Fix Location input keyboard obstruction
- Add `onFocus` scroll-into-view to the Time `Input` as well
- Increase the scroll delay from 300ms to 400ms for Location to give the keyboard more time
- Add `pb-4` padding below the last form field before the sticky button to ensure there's scroll room

### Files to modify
- `src/pages/Albums.tsx` — Add red Trash2 discard button, hide default X, add onFocus scroll-into-view
- `src/pages/Events.tsx` — Add onFocus to Time input, increase padding at bottom of form

