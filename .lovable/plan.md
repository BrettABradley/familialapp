

## Plan: Fix Members Dialog Scrolling and Keyboard UX

### Problem
The Members dialog uses `DialogContent` with default padding and a fixed `max-h-96` inner scroll container, creating a large white frame (header + footer padding) that eats into visible member space. On mobile, the alias input keyboard pushes content out of view.

### Changes in `src/pages/Circles.tsx`

1. **Reduce dialog chrome**: Remove the `max-h-96` constraint on the member list and instead let the `DialogContent` scrollable area handle it. Use `sm:max-h-[70vh]` on the member list so it fills more of the dialog on mobile while staying bounded on desktop.

2. **Compact padding**: Add tighter padding classes to the `DialogContent` for this dialog (`p-4 pt-[max(env(safe-area-inset-top,0px),1rem)]`) so the white border/frame around the member list is minimal.

3. **Keyboard-safe alias input**: Add `scroll-margin-bottom: 260px` (already global for input/textarea) — verify the alias `Input` inherits this. Wrap the member list in a container that allows the focused input to scroll into view above the keyboard. The `MemberRow` alias input should call `scrollIntoView({ block: 'center' })` on focus to ensure it's visible above the keyboard.

### Files to modify
- `src/pages/Circles.tsx` — Members dialog layout and MemberRow alias input focus behavior

