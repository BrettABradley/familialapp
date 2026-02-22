

## Plan: Circle Navigation, Login Redirect, and Smooth Page Transitions

### 1. Clickable Circle Names Navigate to Feed
On the Circles page, make each circle's name a clickable link. When tapped, it will:
- Set the selected circle in the CircleContext to that circle
- Navigate the user to `/feed`, which will then show posts filtered to that circle

This will be done on the `CardTitle` element in `src/pages/Circles.tsx` (around line 506), wrapping the circle name in a clickable element that calls `setSelectedCircle` from the context and then navigates to `/feed`.

### 2. Login Redirects to Circles Page (not Feed)
In `src/pages/Auth.tsx` (line 29), change the post-login redirect from `/feed` to `/circles` so users land on the Circles page first after signing in.

### 3. Smoother Page Transitions (Eliminate White Flash)
The white screen "stutter" between pages is caused by each page independently loading data and showing nothing (or a blank container) until the data arrives. To fix this:

- **Add CSS transitions on route changes**: Wrap the `<Outlet />` in `AppLayout.tsx` with a fade-in animation so new pages smoothly appear instead of flashing white.
- **Add a global CSS animation class** (e.g., `animate-fade-in`) in `src/index.css` that applies a quick opacity transition on page mount.
- **Ensure skeleton loaders render immediately**: Pages already have skeletons, but the fade-in will mask the brief moment before React mounts the new page component.

### Technical Details

**Files to modify:**

| File | Change |
|------|--------|
| `src/pages/Circles.tsx` | Make circle name clickable -- import `useCircleContext`'s `setSelectedCircle`, wrap name in a button/link that sets the circle and navigates to `/feed` |
| `src/pages/Auth.tsx` | Change `navigate("/feed")` to `navigate("/circles")` on line 29 |
| `src/components/layout/AppLayout.tsx` | Wrap `<Outlet />` with a fade-in animation container |
| `src/index.css` | Add a `page-fade-in` keyframe animation |

