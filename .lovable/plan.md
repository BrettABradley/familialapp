# Fix email verification UX

## Problem

When a user signs up on the iOS app and taps **Verify Email** in the email, the link opens Chrome/Safari and logs them into the web version of Familial instead of bouncing them back to the native app.

The reliable fix is to stop auto-logging-in on the verification page and show a clean "Verified — return to the app" confirmation screen instead.

## Key correction from previous plan

The real iOS bundle identifier is **`space.manus.familial.mobile.t20260223211425`** (Apple Team ID `U7U8LZV7K8`) — NOT the Lovable default `app.lovable.f7454400…` or the stale `com.familialmedia.familial` currently in `capacitor.config.ts`. The AASA file at `public/.well-known/apple-app-site-association` already correctly references the real bundle and whitelists `/auth/callback` for universal links.

This means: if the user taps the verify link on an iPhone that has the app installed AND the AASA file is being served from the same domain as the verify link, iOS *should* hand off to the app automatically. We'll lean on that, plus give a graceful confirmation page as the fallback so even when the hand-off doesn't fire (different domain, app not installed, link opened on desktop), the user gets a clear "go back to the app" screen instead of being silently signed into the web app.

## Plan

### 1. Rewrite `/auth/callback` (`src/pages/AuthCallback.tsx`)

After `exchangeCodeForSession` (or `setSession`) succeeds:
- **Immediately sign out of the web session** (`supabase.auth.signOut()` + clear `sb-*-auth-token` from localStorage) so the user is not logged into Chrome.
- Remove the auto-redirect `setTimeout`.
- Render a static success state:
  - Green check + heading **"Email verified"**
  - Body: **"You're all set. Open the Familial app on your phone to sign in."**
  - Primary button **"Open Familial app"** — sets `window.location.href` to the universal link `https://familialapp.lovable.app/auth/callback?verified=1` (iOS will route into the app if installed; otherwise stays on this page).
  - Secondary text link **"Continue in browser"** → `/auth`.
- Keep the existing "Link expired" error state untouched.

### 2. Fix the stale Capacitor bundle ID

Update `capacitor.config.ts`:
```
appId: 'space.manus.familial.mobile.t20260223211425'
```
This matches what's actually shipped in the iOS project and what AASA expects. (No code references the appId directly in app logic, so this is just a config correction.)

### 3. Verify AASA accessibility (no code change, just a check note in the plan)

`public/.well-known/apple-app-site-association` already lists the right `appID` and `/auth/callback*` paths. It will be served from whatever origin email links use (`window.location.origin` at signup time — typically `https://familialapp.lovable.app`). That's the same origin the AASA is hosted on, so universal-link hand-off should work for users who signed up on the web. For users who signed up *inside* the native app, `window.location.origin` will be the Capacitor webview origin — those links won't deep-link, which is exactly why the confirmation page matters as the fallback.

### 4. No backend / email template changes

`auth-email-hook` and `signup.tsx` stay as-is. The link target (`/auth/callback`) is unchanged — we're only changing what that page does on success.

### 5. Verification

- Fresh signup → click verify link → expect the new confirmation screen, NOT the feed.
- Confirm browser is signed out (no `sb-*-auth-token` in localStorage).
- Open the native app → sign in with the same credentials → lands in onboarding (TOS gate → first circle), confirming `email_confirmed_at` was set server-side.
- On a phone with the app installed, tapping verify should ideally hand off to the app via AASA; if not, the fallback confirmation page tells them what to do.

## Technical notes

- Signing out after `exchangeCodeForSession` is safe — Supabase has already persisted `email_confirmed_at` server-side at that point.
- We are NOT introducing a custom URL scheme. Universal links via AASA are the only deep-link path, and they're already configured.
- `postAuthRedirect` localStorage cleanup is preserved for the (rare) web-signup case where someone signed up mid-checkout.
