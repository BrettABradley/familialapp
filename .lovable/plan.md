# Auth Improvements

Three changes to `src/pages/Auth.tsx` (and `src/pages/ResetPassword.tsx` for the toggle). All frontend — no backend/schema changes.

## 1. "Looks like you already have an account — login" with hyperlink

Today the duplicate-signup path shows a toast and flips `setIsLogin(true)`. We'll replace that with an inline error block above the signup form:

> **Looks like you already have an account — [login](#)**

- Detect duplicate via existing two paths in the code:
  - `error.message.includes("User already registered")`
  - `data.user.identities.length === 0` (already handled in `useAuth.signUp`)
- Render the message inline (red text, matches existing `errors` styling) with the word "login" as a clickable link that calls `setIsLogin(true)` and clears the error.
- Keep a toast as secondary feedback but make the inline link the primary CTA.

## 2. Password reset "email rate limit exceeded" on iOS

### Root cause
The error string `email rate limit exceeded` comes from **Supabase Auth's built-in per-email rate limiter**, not from our email provider or the device. Supabase limits `resetPasswordForEmail` to a small number of requests per hour per email (default ~4/hour, shared with signup/magic-link). It's reported as iOS only because that's where the user is testing — the limit is server-side and applies to web too.

Contributing factors in the current code (`handleForgotPassword`, lines 139-158):
- No client-side cooldown — a user can tap "Send Reset Link" repeatedly and burn through the quota in seconds.
- The raw Supabase error message is shown verbatim, which is confusing ("email rate limit exceeded" sounds like a hard failure rather than "wait a minute").
- The auth-email-hook (custom Resend-based reset email) still goes through Supabase's rate limiter before the hook fires.

### Fix
Frontend mitigations in `Auth.tsx`:
1. **Disable the button + 60-second cooldown** after a successful send (and after a rate-limit error). Show "Resend available in Ns" on the button.
2. **Friendlier error mapping** — when Supabase returns `email rate limit exceeded` or `over_email_send_rate_limit`, show:
   > "Too many reset requests. Please wait a minute and try again, or check your inbox (and spam folder) for an earlier link."
3. **Always show success-style toast** for valid emails after first send so users stop re-tapping.
4. Persist last-sent timestamp per email in `sessionStorage` so navigating away doesn't reset the cooldown.

No edge-function or Supabase config changes required. The hourly server limit will still apply, but users won't trip it accidentally.

## 3. Password visibility toggle

Add an Eye / EyeOff icon button inside the password input on:
- `Auth.tsx` (login + signup password field, line ~424)
- `ResetPassword.tsx` (both "new password" and "confirm password" fields, lines 107 & 117)

Implementation:
- Wrap the Input in a `relative` container, position the icon button absolutely right.
- Local `showPassword` state per field; toggles `type` between `"password"` and `"text"`.
- Use `lucide-react`'s `Eye` / `EyeOff` icons (already used elsewhere).
- 44×44 px touch target on mobile (matches existing mobile-first standard).
- `aria-label` "Show password" / "Hide password" for a11y.

## Technical notes
- No DB migration, no edge function, no Capacitor rebuild needed — these are pure web changes that ship to both the web app and the existing iOS WebView build on next publish.
- All three changes land in 2 files: `src/pages/Auth.tsx`, `src/pages/ResetPassword.tsx`.
