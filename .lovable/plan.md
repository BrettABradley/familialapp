

# Replace TOTP 2FA with Email-Based 2FA

## Problem
TOTP (authenticator app) 2FA forces mobile users to switch apps to get a code, which is clunky and often breaks the flow. Email-based 2FA lets users receive a code in their inbox and enter it on the same device.

## Approach
Since Supabase MFA only supports TOTP natively, we'll build a custom email OTP flow:

1. **New Edge Function: `send-2fa-code`** — generates a 6-digit code, stores it in a `two_factor_codes` table (with 5-minute expiry), and emails it via Resend.

2. **New Edge Function: `verify-2fa-code`** — validates the code against the table, marks it used, and returns success/failure.

3. **New DB table: `two_factor_codes`** — stores `user_id`, `code`, `expires_at`, `used`. No RLS needed (only accessed by edge functions via service role).

4. **Add `two_factor_enabled` column to `profiles`** — boolean flag users toggle in Settings.

5. **Update `Auth.tsx`** — after successful password login, check if `two_factor_enabled` is true on the user's profile. If so, call `send-2fa-code`, then show the 6-digit input. On submit, call `verify-2fa-code`. Only proceed to the app on success.

6. **Update `Settings.tsx`** — replace the TOTP QR code enrollment with a simple toggle. When enabling, send a verification code to confirm the user's email first. Remove all `supabase.auth.mfa.*` calls.

7. **Clean up** — remove Supabase MFA factor checks from Auth.tsx, remove QR code UI from Settings.tsx.

## Security Details
- Codes expire after 5 minutes
- Max 3 active codes per user (rate limit in edge function)
- Codes are single-use (marked `used = true` after verification)
- Edge functions use service role to access the codes table (no client-side RLS)

## Files Changed

| Type | File |
|------|------|
| Migration | Create `two_factor_codes` table; add `two_factor_enabled` to `profiles` |
| New | `supabase/functions/send-2fa-code/index.ts` |
| New | `supabase/functions/verify-2fa-code/index.ts` |
| Updated | `src/pages/Settings.tsx` — replace TOTP with email 2FA toggle |
| Updated | `src/pages/Auth.tsx` — replace TOTP challenge with email code challenge |

