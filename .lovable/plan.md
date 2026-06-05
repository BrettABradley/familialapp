# "Email rate exceeded" on invitee signup

## What's actually happening

I checked the email logs for the last few days — every recent `signup` row is `sent` with no errors, including for the addresses your friend has been inviting (`willroark16@gmail.com`, `raeleigh.roark@gmail.com`, etc.). So our outbound queue is healthy and emails *are* being delivered.

The "email rate exceeded" message is coming directly from Supabase Auth's **per-email signup throttle**, not from our email pipeline. Supabase blocks the same email address from triggering more than one signup email within ~60 seconds (and there is a softer per-hour cap as well). The exact string is `For security purposes, you can only request this after N seconds` / `over_email_send_rate_limit`.

This trips in real, common situations for invitees:
1. They tap "Sign Up", switch to Mail to verify, come back and tap "Sign Up" again because nothing visibly happened → second call hits the 60s throttle.
2. They double-tap the button on a slow connection.
3. They start signup, abandon, then return a few seconds later from the invite link.
4. They were already invited as a placeholder account, so Supabase considers the address "recently emailed."

## Why the screenshot they sent is just an iPhone status bar

The image in the email shows the iPhone status bar (9:51, phone call timer 5:42, 99% battery) — it's not an in-app error screen, it's just what was on her phone when she took the screenshot of the Familial signup page. The actual blocker is the toast message our code already shows on rate limit:

> "Too many verification emails sent to this address. Check your inbox and spam folder for the link we already sent, or try again in a few minutes."

Today that toast only auto-restores the **"Check your email"** panel if `sessionStorage.pendingVerificationEmail === email`. For a brand new invitee on a fresh device that key is empty, so they just see a red error toast and the same signup form — there's no obvious next step, which feels like a glitch.

## The fix

Make the Auth page treat a rate-limit response as proof that **an email was already sent to this address**, and drop the user onto the "Check your email" panel every time — even when local sessionStorage is empty. Then they can wait, tap the resend button when the cooldown ends, or just open the email that's already in their inbox.

### Changes (frontend only — `src/pages/Auth.tsx`)

1. **Signup rate-limit branch (`handleSubmit`, ~lines 384–404)** — remove the `if (pendingEmail === email)` guard. On *any* `isEmailRateLimitError(error)` during signUp:
   - Set `verificationSentTo = email`
   - Save the password into the ref + sessionStorage so the silent verification poll can pick up once they click the link
   - Start the 60s `resendCooldown` and write `RESEND_VERIFY_KEY`
   - Write `PENDING_VERIFY_EMAIL_KEY = email`
   - Toast wording: "We already sent a verification link to {email}. Please check your inbox and spam folder — you can request another in 60 seconds." (less alarming than "Too many…")

2. **Pre-submit cooldown short-circuit (~lines 353–374)** — keep the existing "if pendingEmail === email and still in cooldown, just re-show the panel" logic. Tighten it to also fire when `pendingEmail` is empty *but* `lastSendAt` is within the cooldown for the same `email` (rare but covers double-tap with a cleared session).

3. **Forgot-password rate-limit branch (~lines 286–302)** — keep behavior, but improve copy ("A reset link was already sent. Check spam, or try again in 90 seconds.") and don't close `isForgotPassword` so they still see the email input/state.

4. **Resend button (~lines 432–456)** — when `isEmailRateLimitError`, surface the remaining cooldown in seconds instead of a generic message.

### Not in scope (won't change)

- No backend/RLS/edge-function changes. `auth-email-hook` and the email queue are working correctly; logs confirm delivery.
- Not changing Supabase's per-email throttle itself (it's a built-in security control we shouldn't disable).
- No iOS rebuild required — pure web/JS.

## Verification

- Trigger a signup twice in <60s with a fresh email in an incognito window → should land on the "Check your email" panel both times with a soft toast, not a red error on the signup form.
- Existing single-attempt signup, resend cooldown, password reset, and silent verification poll continue to work unchanged.
