

## Plan: Make Auth Page Keyboard-Friendly on Mobile

### Problem
On the mobile app, when the keyboard opens to type email or password, it covers the Sign In button and lower form fields. The page needs to scroll up so the focused input and submit button remain visible.

### Changes

#### `src/pages/Auth.tsx`
- Change the outer container from `flex items-center justify-center` (which vertically centers and prevents scrolling) to a scrollable layout that pushes content toward the top when the keyboard is open
- Use `min-h-[100dvh]` with `items-end` or `items-center` and make the container scrollable so iOS can push the viewport up
- Add `pb-[env(safe-area-inset-bottom,0px)]` for bottom safe area
- The key fix: replace the rigid centering layout with a scrollable column that uses padding to center when keyboard is closed, but allows natural scrolling when keyboard is open

Specifically:
- Outer div: change to `min-h-[100dvh] flex flex-col justify-center px-4 overflow-y-auto`
- This allows the browser/Capacitor to scroll the form into view when the keyboard appears
- The `justify-center` still centers the card when there's room, but `overflow-y-auto` lets it scroll when the keyboard takes space

