## What's already working

Supabase's `/auth/v1/verify` endpoint marks `email_confirmed_at` on the user **server-side** *before* it redirects to `/auth/callback?code=…`. The auth logs confirm this: `user_signedup` (action) fires on `/verify` with a 303 response. So by the time the green check page paints, the email is already verified in the database — the green page is truthful proof, not just a visual.

The PKCE `?code=…` we strip is only for creating a *browser session*. Discarding it does not affect verification state.

When the user returns to the iOS app and signs in, Supabase issues a fresh JWT whose `user.email_confirmed_at` is populated, so `AppLayout`'s `UnverifiedEmailGate` is bypassed and the `familial:emailJustVerified` flag triggers the green-check toast → onboarding continues.

## What's missing (small gap)

If the user was *already signed in on the device* before tapping the verify link in the email (e.g. they hit "Resend verification" from `UnverifiedEmailGate` and verified in another tab/browser), their cached JWT still has `email_confirmed_at = null`. They'd be stuck on the "Verify your email" gate until they manually sign out and back in.

## Fix

**`src/components/layout/AppLayout.tsx`** — In `UnverifiedEmailGate`, on mount and on window `focus`, call `supabase.auth.refreshSession()`. If the refreshed user has `email_confirmed_at` set, the parent re-renders (because `useAuth` propagates the new user) and the gate disappears automatically — the green-check flash effect already in place then fires.

Also add a "I already verified — refresh" button on the gate as an explicit manual escape hatch, calling the same refresh.

That's it. No changes to `AuthCallback.tsx`, `index.html`, `useAuth.tsx`, or any backend/edge code. The verification itself is already guaranteed by Supabase before the green page renders.

## Out of scope

- Email template / auth-email-hook
- PKCE stripping (already in place from prior step)
- Onboarding flow itself