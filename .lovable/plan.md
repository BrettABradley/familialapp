

## Plan: Fix Post-Login Redirect + Auth Page Logo Size + Unnecessary Keyboard Scroll

### Three Issues

**Issue 1 — Login redirects to Settings instead of Circles**: When a user's session expires while on `/settings` (or `/profile`), `AppLayout` saves that path to `postAuthRedirect`. On next login, `Auth.tsx` reads it and navigates there instead of `/circles`. Fix: exclude `/settings` and `/profile` paths from being saved as redirect targets.

**Issue 2 — Logo too large on mobile login**: The `h-24` logo pushes the card content down, making it look awkward and contributing to the keyboard overlap issue. Reduce to `h-16` on mobile, keep `h-24` on desktop.

**Issue 3 — Unnecessary scroll on keyboard open**: The global `scroll-margin-bottom: 260px` on all inputs causes the browser to aggressively scroll inputs into view even when they're already visible. This creates the jarring "scroll up" effect on forms like Create Album and Events where everything fits. Reduce this value to something more conservative (e.g., `80px` — just enough to clear the input, not enough to force a large scroll).

### Changes

#### 1. `src/components/layout/AppLayout.tsx` — Filter redirect paths
- Don't save `/settings` or `/profile` to `postAuthRedirect` — these are not meaningful return destinations after login. Always land on `/circles`.

#### 2. `src/pages/Auth.tsx` — Smaller logo on mobile
- Change logo from `h-24` to `h-16 sm:h-24` so it's more compact on mobile
- Also fix the duplicate nested div in the loading state

#### 3. `src/index.css` — Reduce scroll-margin-bottom
- Change from `260px` to `80px` to prevent unnecessary large scrolls when inputs are already visible. The keyboard resize (`resize: 'body'`) handles the main visibility — the margin just needs a small buffer.

### Files to modify
- `src/components/layout/AppLayout.tsx` — filter saved redirect paths
- `src/pages/Auth.tsx` — smaller mobile logo, fix loading state
- `src/index.css` — reduce scroll-margin-bottom

