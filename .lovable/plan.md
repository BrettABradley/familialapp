# Fix "email rate limit exceeded" during invite signup

## What's happening

Your customer's daughter received the invite email fine (that goes through Resend via `send-circle-invite` and is not rate limited). The error she hit is from a *separate* email Supabase Auth itself sends — the **signup confirmation email** that goes out when she creates her account on `/auth?mode=signup`.

Supabase Auth applies a per-project email rate limit (default **30 emails/hour**, with stricter per-address throttling — typically 1 email per ~60 seconds and ~4/hour to the same address). If she (or the mom, while testing) hit the signup form, the "resend verification" button, or a forgot-password flow even a few times in a row with the same email, Supabase blocks further sends with `over_email_send_rate_limit` and surfaces it as "email rate limit exceeded."

Right now nothing in the circle is broken — the mom is still on Free and only has 2 members. The bottleneck is purely the auth email throttle on the daughter's address.

## The fix (three parts)

### 1. Raise Supabase Auth email rate limits (project setting — no code)

This is the only real unblock. In the Lovable Cloud backend's Auth → Rate Limits panel:

- **Emails per hour**: raise from default `30` → `150` (or higher; we are paying Resend per email so the Supabase number is just a safety cap).
- Confirm the project is using the custom `auth-email-hook` (it already is) so these go through Resend rather than Supabase's shared SMTP pool.

No migration is needed; I'll just tell you exactly where to click, or you can let me open the backend panel.

### 2. Make repeat signup attempts not burn rate-limit budget

In `src/pages/Auth.tsx` the signup path calls `supabase.auth.signUp()` every time the user re-submits the form, even if a verification email was already sent moments ago. Each submission counts against the per-address throttle. Changes:

- If the user just submitted signup for `email X` (we already track `PENDING_VERIFY_EMAIL_KEY` in sessionStorage), and they submit again for the same email within the cooldown window, **skip the network call** and just re-show the "check your email" panel.
- Same treatment for the "Resend verification" button — it already has `RESEND_VERIFY_COOLDOWN` but the cooldown isn't enforced server-side, so increase it to 60s and disable the button visibly with a countdown.
- For forgot-password, persist `RESET_COOLDOWN_KEY` across reloads (currently sessionStorage; bump to 90s and show the countdown in the button).

### 3. Friendlier error messaging when the limit does hit

In `src/pages/Auth.tsx` `handleSubmit` signup branch and `handleResendVerification`, detect `over_email_send_rate_limit` / `429` and show:

> "Too many verification emails sent to this address. Please check your inbox and spam folder for the link we already sent — or try again in a few minutes."

…instead of the raw Supabase message. (This pattern already exists for forgot-password; mirror it for signup + resend.)

## What I will NOT change

- The invite email flow (`send-circle-invite` via Resend) — it is working and is not the cause.
- Circle member limits, billing, or the Free-plan 8-seat allowance — the mom is well under her limit.
- Database schema, RLS, or any edge function other than client-side `Auth.tsx` improvements.

## How to verify after rollout

1. Have the customer's daughter open the invite email again and tap the signup CTA.
2. She enters her email + password → she should land on the "Check your email" screen and receive the Supabase confirmation email from `support@support.familialmedia.com`.
3. Click the link → she is auto-joined to the mom's circle.

## Technical notes (for reference)

- Supabase setting paths: Auth → Rate Limits → "Rate limit for sending emails" and "Rate limit for token verifications".
- Per-address throttle is enforced by `gotrue` and cannot be disabled, only widened by increasing the per-hour ceiling and by ensuring our custom email hook returns 2xx quickly (already does).
- Files touched in code: `src/pages/Auth.tsx` only.

Want me to proceed with the `Auth.tsx` hardening and walk you through the rate-limit setting change?
