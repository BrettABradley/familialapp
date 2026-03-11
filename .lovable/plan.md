

# Fix: Logout Not Actually Logging Out

## Problem
When you click "Sign Out," the app calls `supabase.auth.signOut()` and immediately navigates to `/` (the landing page). The issue is:
1. The navigation happens before the auth state change fully propagates
2. Landing on `/` (the marketing homepage) doesn't reflect logout status — it looks like nothing happened

## Fix
In `src/components/layout/AppLayout.tsx`, change `handleSignOut` to:
1. **Await** the sign-out call (already done)
2. Navigate to `/auth` instead of `/` so the user clearly sees they've been logged out

```typescript
const handleSignOut = async () => {
  await signOut();
  navigate("/auth");
};
```

Single line change in one file.

