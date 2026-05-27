## Problem

1. After tapping "Verify Email" in the browser (web flow), the iOS app stays stuck on the "Check your email" screen forever. This is because the web `/auth/callback` intentionally does NOT create a browser session — it only triggers Supabase's server-side `email_confirmed_at`. The iOS app has no way of knowing the email was confirmed, so it never advances to the green-check "Email verified" state.

2. The web success page shows an "Open Familial app" button that uses a Universal Link, which doesn't reliably open the installed app and is unnecessary — users can just swap back to the app themselves.

## Fix

### 1. Auto-confirm on the app's "Check your email" screen (`src/pages/Auth.tsx`)

- Stash the signup password in a `useRef` (instead of only `setPassword("")`) when the verification panel is shown, so we can re-attempt sign-in silently.
- While the `verificationSentTo` panel is mounted, poll every ~3 seconds with `supabase.auth.signInWithPassword({ email, password })`.
  - As soon as Supabase returns success (which only happens once `email_confirmed_at` is set server-side), the existing `useEffect` on `user` fires, sets `confirmed = true`, shows the green check for 1.5 s, and routes to `/circles`.
  - Ignore the expected `Email not confirmed` error silently between polls.
- Stop polling when the panel unmounts, the user signs in, or the user taps "Use a different email" (also clears the password ref).
- Keep the existing "Resend verification email" and "Use a different email" buttons unchanged.

This means: user taps the link in the email → browser shows the success page → user comes back to the app → within ~3 s the app auto-detects the confirmation, flashes the green check, and continues into onboarding. No manual action required on the app.

### 2. Simplify the web success screen (`src/pages/AuthCallback.tsx`)

In the `status === "success"` block:
- Remove the `<Button onClick={openApp}>Open Familial app</Button>`.
- Remove the now-unused `openApp` function and the `Button` import if it becomes unused.
- Replace the body copy with: **"You may proceed back to the app."** (single line, same `text-sm text-muted-foreground` styling).
- Remove the "Continue in browser" link as well, since it's only useful when paired with the app button — keeps the screen clean for both iOS and web users who all just need to switch back.

The green check, "Email verified" heading, and logo stay as-is.

### Technical notes

- Polling interval: 3000 ms, cleared on unmount via `useEffect` return.
- The poll only runs while `verificationSentTo && !confirmed && !user`.
- Password ref is cleared on `handleUseDifferentEmail` to avoid stale credentials being reused for a new email.
- No backend, RLS, or edge-function changes are needed — Supabase already exposes `email_confirmed_at` via the standard sign-in attempt.

## Files touched
- `src/pages/Auth.tsx` — password ref + poll-for-confirmation effect
- `src/pages/AuthCallback.tsx` — simplified success screen, remove openApp button
