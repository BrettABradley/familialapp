## Why it still auto-signed you into Chrome

Three things are working against the current setup:

1. **The verify link probably never reached `/auth/callback`.** In `useAuth.signUp()` we use `${window.location.origin}/auth/callback`. If the signup happened from the iOS sim/TestFlight build, `window.location.origin` is `capacitor://localhost`, which Supabase silently rejects and falls back to the project's **Site URL** (the bare published web URL). The verification link then redirects to `https://familialapp.lovable.app/#access_token=...&refresh_token=...` — the **root** route, not `/auth/callback`.
2. **Index/AuthProvider auto-consumes the hash tokens.** When supabase-js initializes on any page with `access_token` in the URL hash, it auto-creates a session and fires `SIGNED_IN`. Result: you land on `/`, get instantly signed in, AuthCallback never runs, no green check.
3. **Even when `/auth/callback` does run on web, we exchange the code for a session before signing out.** That brief session is enough to trip any listener watching `user`. Belt-and-suspenders, but worth removing.

## Fix — three small changes that solve all of it

### 1. Pin the redirect URL to the production web origin

`src/hooks/useAuth.tsx` (both `signUp` and `resendVerification`):
- Replace `${window.location.origin}/auth/callback` with a constant `https://familialapp.lovable.app/auth/callback`.
- This guarantees the verify email always points at our handler, regardless of whether signup happened in the web app, the iOS simulator, or TestFlight.
- iOS Universal Links + AASA already route that URL to the native app when installed; otherwise the browser opens it.

### 2. Add a global hash-token interceptor at the App root

`src/App.tsx` — add a tiny component mounted above `<BrowserRouter>` content (alongside `NativeUrlOpenBridge`):
- On mount, if `window.location.hash` contains `access_token=` or `type=signup`/`type=recovery`, and we're NOT already on `/auth/callback` or `/reset-password`, do a `window.location.replace("/auth/callback" + window.location.hash)`.
- This catches any legacy email link that lands on `/` and reroutes before supabase-js auto-signs them in.
- The replace happens synchronously before AuthProvider mounts effects, so no flash of signed-in state.

### 3. Branch `AuthCallback.tsx` by platform

Right now it always exchanges the code and then signs out. Split the behavior:

- **Web (`!Capacitor.isNativePlatform()`)**:
  - **Do not call `exchangeCodeForSession` at all.** The Supabase `/auth/v1/verify` endpoint already set `email_confirmed_at` server-side before redirecting to us. We don't need a session to "prove" the verification.
  - Just strip the URL, set `localStorage.setItem("familial:emailJustVerified", "1")` (used by the app for the welcome flash), and render the green check + "Open Familial app" / "Continue in browser" UI we already have.
  - Removes the sign-out gymnastics entirely — no session is ever created in the browser.

- **Native (`Capacitor.isNativePlatform()`)**:
  - Exchange the code → user is now signed in inside the app.
  - Set `sessionStorage.setItem("familial:emailJustVerified", "1")`.
  - `navigate("/circles", { replace: true })` (or wherever the TermsAcceptanceGate / first-circle onboarding starts). The gate already runs there and will continue the funnel.

### 4. Show the "Email verified" flash once after sign-in

`src/components/layout/AppLayout.tsx` (or wherever post-auth landing renders) — add a one-shot effect:
- On mount, if `localStorage.getItem("familial:emailJustVerified") === "1"` AND there's a signed-in user, fire a 2-second toast with a green check + "Email verified — welcome to Familial" then `localStorage.removeItem("familial:emailJustVerified")`.
- Works for both flows:
  - **Web path**: user verifies → returns to app on phone → opens app → signs in → flash fires.
  - **Native path**: user taps link → Universal Link opens app → AuthCallback handles exchange → routes to `/circles` → flash fires once.

### What I am NOT changing

- The `auth-email-hook` and template files — `confirmationUrl: payload.data.url` is correct; the URL Supabase generates already encodes our `redirect_to`. Once #1 above is in, the URL it produces will be right.
- The `Auth.tsx` signup form, verification panel, or the iOS bundle/AASA — those are already correct.
- The orphan-user rate-limit work from the earlier plan — still parked.

## Test matrix (after the change)

| Where you signed up | Where you clicked the link | Expected |
|---|---|---|
| Web (Chrome) | Chrome | Green check page, NOT signed in, "Open app" + "Continue in browser" |
| Web (Chrome) | Phone (iOS app installed) | App opens, exchanges, flashes "Email verified", lands in onboarding |
| iOS app | Chrome | Same as row 1 (green check on web, app-side sign-in still required) |
| iOS app | Phone | Same as row 2 |
