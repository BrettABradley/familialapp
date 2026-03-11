

# Fix: Sign Out Not Actually Logging Out

## Problem
When clicking "Sign Out," the `signOut()` call completes but the navigation races with `onAuthStateChange` and stale React state. The `CircleContext` and other components may re-trigger queries before the auth state fully propagates, causing the app to appear still logged in. Additionally, `localStorage` retains `selectedCircle` and other cached data.

## Solution
Replace the soft `navigate("/auth")` with a hard redirect (`window.location.href = "/auth"`) after sign-out. This ensures:
1. All React state is fully cleared (no stale context)
2. `localStorage` circle selection doesn't cause ghost state
3. No race condition between `onAuthStateChange` and React Router

## Changes

### `src/components/layout/AppLayout.tsx`
Update `handleSignOut`:
```typescript
const handleSignOut = async () => {
  localStorage.removeItem("selectedCircle");
  await signOut();
  window.location.href = "/auth";
};
```

Single file, 3-line change.

