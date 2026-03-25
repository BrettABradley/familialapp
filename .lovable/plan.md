

## Plan: Fix Auth Page Keyboard Blocking Sign-In Button on Mobile

### Problem
The Auth page uses `justify-center` which vertically centers the card. When the keyboard opens, the viewport shrinks (thanks to `resize: 'body'`), but the card stays centered in the now-smaller viewport — pushing the bottom (sign-in button) below the fold with no room to scroll.

### Solution
Change the Auth page layout from vertically centered to top-aligned with auto margins, so the card sits higher on the screen. When the keyboard opens and the viewport shrinks, the card content overflows downward and becomes scrollable — keeping the sign-in button reachable by scrolling.

### Changes

#### `src/pages/Auth.tsx`
- Change the outer container from `flex flex-col items-center justify-center` to `flex flex-col items-center justify-start pt-[env(safe-area-inset-top,0px)]`
- Add top padding (`pt-12 sm:pt-0 sm:justify-center`) so on desktop it still centers, but on mobile the card starts higher
- This means when the keyboard opens, the form naturally scrolls and the sign-in button is reachable

### Files to modify
- `src/pages/Auth.tsx` — switch from centered to top-biased layout on mobile

