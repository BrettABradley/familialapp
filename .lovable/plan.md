

## Plan: Fix Login Logo Size, Post-Login Redirect, Card Position, and Auto-Scroll Bugs

### Four Issues

**Issue 1 — Logo too small**: The logo was changed to `h-16 sm:h-24` but user wants the original `h-24` size on mobile too. Revert to `h-24`.

**Issue 2 — Login redirects to Settings**: Despite the exclusion logic in `AppLayout`, a stale `postAuthRedirect` value may persist in localStorage from before the fix was deployed. Two fixes needed: (a) clear `postAuthRedirect` during sign-out, (b) add a safety check in `Auth.tsx` that rejects saved redirects to `/settings` or `/profile`.

**Issue 3 — Card too high on mobile (overlapping Dynamic Island)**: The card uses `pt-12` which isn't enough on phones with a Dynamic Island. Change to `pt-[calc(env(safe-area-inset-top,0px)+1rem)]` so the card sits below the camera cutout, and remove the fixed `pt-12`.

**Issue 4 — Unnecessary auto-scrolling on input focus**: Multiple form components have manual `onFocus={() => scrollIntoView()}` handlers that force the page to jump even when the input is already visible. With `resize: 'body'` now active, the browser handles this natively. These manual handlers should be removed from:
- `src/pages/Events.tsx` — 6 occurrences on description, time, location inputs (create + edit forms)
- `src/pages/Albums.tsx` — 2 occurrences on album name and description inputs
- `src/pages/Circles.tsx` — 1 occurrence on alias rename input

The global `scroll-margin-bottom: 80px` in CSS already provides a small buffer for the native scroll behavior.

### Changes

#### 1. `src/pages/Auth.tsx`
- Revert logo from `h-16 sm:h-24` back to `h-24`
- Change `pt-12` to `pt-[calc(env(safe-area-inset-top,0px)+1rem)]` to respect Dynamic Island
- Add safety filter on `savedRedirect` — skip if it starts with `/settings` or `/profile`

#### 2. `src/components/layout/AppLayout.tsx`
- In `handleSignOut`, also clear `postAuthRedirect` from localStorage

#### 3. `src/pages/Events.tsx`
- Remove all `onFocus={(e) => setTimeout(() => e.target.scrollIntoView(...))}` handlers (6 instances)

#### 4. `src/pages/Albums.tsx`
- Remove `onFocus` scrollIntoView handlers (2 instances)

#### 5. `src/pages/Circles.tsx`
- Remove `onFocus` scrollIntoView handler (1 instance)

### Files to modify
- `src/pages/Auth.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/pages/Events.tsx`
- `src/pages/Albums.tsx`
- `src/pages/Circles.tsx`

