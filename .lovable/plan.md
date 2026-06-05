# Fix "Use different email" regression in Auth.tsx

## What broke

In the last change I broadened the pre-submit cooldown shortcut from
`pendingEmail === email` to `(pendingEmail === email || !pendingEmail)` (Auth.tsx ~line 360).

That assumes "no pendingEmail + recent send timestamp" always means a send went out for *this* email. It doesn't, because `handleUseDifferentEmail` only clears `PENDING_VERIFY_EMAIL_KEY` — it leaves `RESEND_VERIFY_KEY` (the timestamp) in place.

Effect: a user who signs up with email A, taps "Use different email", then submits email B within 60s gets dropped onto a fake "Check your email" panel for email B without `signUp()` ever being called. No email is sent to B and the silent poll will never resolve.

## Onboarding is fine

`TermsAcceptanceGate` and `OnboardingFlow` only mount once `user.email_confirmed_at` is set; nothing in the signup happy path or the post-confirmation routing changed. Duplicate-account detection, silent verification polling, password reset, and the resend button all still work.

## Fix (frontend only — `src/pages/Auth.tsx`)

1. **`handleUseDifferentEmail` (~line 462)** — also clear `RESEND_VERIFY_KEY` and reset `resendCooldown` to 0, so switching emails starts with a clean slate.

2. **Pre-submit cooldown shortcut (~line 360)** — tighten the condition back to require an actual match: `pendingEmail === email && stillCoolingDown`. The fallback for the "cleared session double-tap" case I was trying to cover is already handled by the post-`signUp()` rate-limit branch, which now drops the user onto the panel on any rate-limit response.

That's it — two small edits, no backend/iOS work, no impact on onboarding.

## Verification

- Sign up email A → "Check your email" → tap "Use different email" → enter email B → should call `signUp()` and actually send a verification to B (not jump straight to the panel).
- Sign up email A twice in <60s → still lands on "Check your email" via the post-signup rate-limit branch (unchanged behavior).
- TermsAcceptanceGate + OnboardingFlow appear after clicking the verification link, same as before.
