

## Plan: Make Form Dialogs Smoothly Scrollable + Re-center Auth Page

### Problem
When tapping inputs in dialogs (Create Album, Create Event, Fridge post, member name edit), the browser's native focus-scroll behavior causes jarring jumps. The user wants these forms to feel like a natural scrollable list — tap an input, type, then scroll down to the next field manually.

### Root Cause
The browser automatically calls `scrollIntoView` on any focused input. Combined with `scroll-margin-bottom: 80px`, this causes visible jumps even when the input is already on screen. The fix is to **prevent the browser's automatic scroll-on-focus inside dialogs**.

### Solution

#### 1. `src/components/ui/dialog.tsx` — Suppress auto-scroll on focus inside dialogs
Add a `focus` event listener (capture phase) on the dialog content element that calls `e.preventDefault()` on the browser's automatic scroll. This is done by using `preventScroll: true` isn't available on the focus event itself, but we can intercept it: after focus fires, immediately reset the scroll position of the dialog container. A cleaner approach: add a thin wrapper that listens for `focus` events on inputs and calls `e.target.focus({ preventScroll: true })` — but this would recurse. 

**Best approach**: Add an `onFocus` capture handler on `DialogContent` that saves the dialog's `scrollTop` before the browser adjusts it, then restores it in a `requestAnimationFrame`. This prevents the jarring jump while still allowing the user to manually scroll.

#### 2. `src/pages/Auth.tsx` — Re-center the login page
Change back to `justify-center` (vertically centered) now that the dialog scroll fix handles keyboard UX. Use `sm:justify-center` and also `justify-center` on mobile. The `overflow-y-auto` ensures it's still scrollable if the viewport shrinks with the keyboard, but the card starts centered.

### Files to modify
- `src/components/ui/dialog.tsx` — add focus-capture scroll preservation
- `src/pages/Auth.tsx` — re-center the card layout (revert `justify-start pt-[...]` back to `justify-center` with safe-area padding kept)

