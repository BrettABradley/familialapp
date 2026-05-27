## Goal
Cut down on bot signups without disrupting any current user, and fix the keyboard covering the Sign in button on Auth.tsx — all without breaking the live submission build.

## Guardrails (what we will NOT do)
- We will NOT force re-verification on existing accounts.
- We will NOT touch the 2FA flow.
- We will NOT block sign-in for any account that already has `email_confirmed_at` set.
- We will NOT change `supabase/config.toml` project settings.

---

## Part 1 — Email verification gate (signups only)

### 1a. Turn off auto-confirm
Disable `auto_confirm_email` so new signups get a verification email. Existing users are unaffected (they already have `email_confirmed_at` set, so the gate we add later treats them as verified).

### 1b. Signup flow change in `useAuth.tsx` / `Auth.tsx`
- After `supabase.auth.signUp(...)`, do NOT treat the returned session as "logged in."
- Show a clean "Check your email to verify" screen with: the email address, a "Resend verification email" button (calls `supabase.auth.resend({ type: 'signup', email })`), and a "Use a different email" link.
- If `signUp` returns a session anyway (race condition), immediately `signOut()` so they cannot get in unverified.

### 1c. Verification landing — works for web AND native, ends with "Verified ✓"
- Add a new public route `/auth/callback`.
- The verification email's `confirmationUrl` already points to a Supabase action URL that 302-redirects to whatever we set as `emailRedirectTo`. We set `emailRedirectTo` to `https://www.familialmedia.com/auth/callback?next=<original-path>` and store `next` in `localStorage.postAuthRedirect` at signup time (we already use this key for OAuth — same pattern).
- The `/auth/callback` page:
  1. Reads the URL hash / query for `access_token` + `refresh_token` (Supabase appends these on the redirect).
  2. Calls `supabase.auth.setSession({ access_token, refresh_token })` — this both verifies the email and signs them in officially.
  3. Renders a centered green checkmark + "Verified" with a soft fade-in (1.5s), then `navigate(next || '/circles', { replace: true })`.
  4. On error (expired/invalid link), shows "This link expired" with a Resend button.

### 1d. Native (iOS) — same UX, opens the app
- Capacitor already registers `app.lovable.f745440093af4f4390a60d52ff08c778` as the bundle id. We add Universal Links so the verification URL opens the installed app instead of Safari:
  - Add `Associated Domains` entitlement `applinks:www.familialmedia.com` and `applinks:familialmedia.com` via `scripts/ios-post-sync.sh` (PlistBuddy + entitlements file — same self-healing pattern we use for `aps-environment`).
  - Publish `apple-app-site-association` at `https://www.familialmedia.com/.well-known/apple-app-site-association` (served from `public/.well-known/` as static JSON, no extension, content-type forced by Lovable hosting):
    ```json
    { "applinks": { "details": [{ "appID": "<TEAMID>.app.lovable.f745440093af4f4390a60d52ff08c778", "paths": ["/auth/callback", "/auth/callback*"] }] } }
    ```
    (We'll need the Apple Team ID from the user — placeholder until then; if missing on first deploy, the link just falls back to Safari, which still works.)
  - When iOS opens the app via the universal link, Capacitor's `App.addListener('appUrlOpen', ...)` fires. We add a listener in `App.tsx` that pushes `/auth/callback?...` into React Router, so the same green-check screen runs.
- Net result: tap link on iPhone → app opens → "Verified ✓" → routed into `/circles` already signed in. If the app isn't installed, Safari opens the same `/auth/callback` web page, same UX.

### 1e. Gate in `AppLayout`
- After session loads, if `user && !user.email_confirmed_at`, render the "Check your email to verify" screen instead of children. This is the safety net so even if someone gets a session before verifying (e.g. across devices), they cannot use the app.
- Existing accounts all have `email_confirmed_at` set → they hit this code path and pass through immediately. Zero disruption.

### 1f. Email template
- The existing `signup.tsx` template already includes the confirmation button. We update the button copy to "Verify your email" and the body to match the app's tone. No new template needed.

---

## Part 2 — Auth.tsx keyboard ScrollArea retrofit (minimal)

- Wrap the form card in a `ScrollArea` with `pb-32` so the Sign in button always scrolls above the keyboard.
- Add `scroll-margin-bottom: 120px` to each `Input` so focus auto-scrolls them into view (this is the exact pattern from `mem://tech/mobile-keyboard-ux-patterns`).
- Do NOT change layout, do NOT switch to a sheet, do NOT add listeners.

---

## Rollback story (in case anything misbehaves at submission)
- If verification breaks signup: re-enable `auto_confirm_email` from Cloud → Users → Auth Settings. Existing users keep working, new users skip the gate. One toggle, zero code revert.
- The `/auth/callback` page and `AppLayout` gate are no-ops for verified users, so leaving them in place is safe.
- Universal Links are additive — if the AASA file is wrong, links just open in Safari. No crash, no broken flow.

---

## Files touched
- `src/hooks/useAuth.tsx` — adjust signUp behavior, expose `resendVerification`.
- `src/pages/Auth.tsx` — "Check your email" state + ScrollArea + scroll-margin-bottom.
- `src/pages/AuthCallback.tsx` — NEW.
- `src/App.tsx` — register `/auth/callback`, add Capacitor `appUrlOpen` listener.
- `src/components/layout/AppLayout.tsx` — email_confirmed_at gate.
- `public/.well-known/apple-app-site-association` — NEW.
- `scripts/ios-post-sync.sh` — add `com.apple.developer.associated-domains` to entitlements.
- `supabase/functions/_shared/email-templates/signup.tsx` — copy tweak.
- `supabase/auth` settings — `auto_confirm_email: false`.

## What I need from you before I build
1. Confirm your **Apple Developer Team ID** (10-char string, e.g. `ABCDE12345`) so the AASA file is correct on first deploy. If you'd rather ship without Universal Links for now, I'll skip 1d's iOS pieces and the email will open Safari → `/auth/callback` on the phone, which still verifies and signs them in (just not inside the app).