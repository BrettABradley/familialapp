

## Plan: Fix Desktop Sign-Out Not Actually Logging Out

### Root Cause
When `supabase.auth.signOut()` fails (e.g., session already expired server-side — confirmed by auth logs showing repeated "session_not_found" 403s), the Supabase client does **not** clear the persisted auth token from localStorage. So while React state is cleared via `setSession(null)` / `setUser(null)`, on the next page load the old token is read back from localStorage, re-authenticating the user silently. The sign-out appears to do nothing.

Additionally, the Settings page sign-out navigates to `/` (the landing page) instead of `/auth`, which is inconsistent.

### Changes

#### 1. `src/hooks/useAuth.tsx` — Force-clear persisted session on sign-out
- After calling `supabase.auth.signOut()` (whether it succeeds or fails), manually remove the Supabase auth token from localStorage using the key pattern `sb-<project-ref>-auth-token`
- This guarantees the stale session is fully purged even when the server returns a 403

#### 2. `src/pages/Settings.tsx` — Use hard redirect to `/auth`
- Change `navigate("/")` to `window.location.href = "/auth"` to match the AppLayout sign-out behavior and ensure a full page reload clears all in-memory state

### Files to modify
- `src/hooks/useAuth.tsx` — add localStorage cleanup
- `src/pages/Settings.tsx` — fix redirect target

