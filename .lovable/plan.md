## Problem

When you comped Gayla (`07b2d321-f751-46ea-beeb-92bdc784b6cc`, gaylabrum@aol.com, "Customer Support" note) on 2026-06-05, the comp itself succeeded but the founder-gift email failed with:

```
Edge Function returned a non-2xx status code
```

No row was even written to `email_send_log`, so the email never went out and she never got it.

Same failure has happened several other times in `admin_actions` (e.g. 5-21 "Friend gift" returned `UNAUTHORIZED_INVALID_JWT_FORMAT / Invalid JWT`), and the same `UNAUTHORIZED_INVALID_JWT_FORMAT` error is showing up in `send-unread-message-emails` logs right now.

## Root cause

`send-transactional-email` only accepts callers whose `Authorization: Bearer ...` token is a JWT containing `role: service_role`. It decodes the JWT manually:

```ts
const callerRole = decodeJwtRole(req.headers.get('Authorization'))
if (callerRole !== 'service_role') return 403 Forbidden
```

The project's `SUPABASE_SERVICE_ROLE_KEY` is now the new-format secret key (`sb_secret_...`), not a legacy JWT. That format has no decodable payload, so `decodeJwtRole` returns `null`, and every server-side caller — including `admin-manage-users` invoking the gift email — gets rejected with 403 / `UNAUTHORIZED_INVALID_JWT_FORMAT`. Auth gift sends that did succeed earlier were on the older JWT-format key; the newer ones started failing once the key was rotated to the new format.

## Fix

1. **`supabase/functions/send-transactional-email/index.ts`** — replace the JWT-role check with a check that accepts either:
   - a JWT whose decoded `role` claim is `service_role` (back-compat with legacy keys), OR
   - a bearer token that exactly matches `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` (new `sb_secret_...` format).

   Keep the same 403 behavior for anything else. No other logic changes.

2. **Deploy** `send-transactional-email` so the fix is live.

3. **Resend Gayla's founder-gift email** by calling `admin-manage-users` (or directly invoking `send-transactional-email`) once with:
   - `templateName: "founder-gift"`
   - `recipientEmail: "gaylabrum@aol.com"`
   - `templateData: { name: "Gayla" }`
   - `idempotencyKey: "founder-gift-07b2d321-f751-46ea-beeb-92bdc784b6cc-resend-2026-06-09"`

   Then verify a `sent` row appears in `email_send_log`.

4. **Sanity-check** the other server-side callers of `send-transactional-email` (e.g. `send-unread-message-emails`, `admin-manage-users` enterprise welcome) — they all use the same service-role invoke pattern, so the same fix unblocks them too. No code changes needed in those callers.

## Out of scope

- Not touching the founder-gift template content.
- Not changing the admin UI flow or `admin-manage-users` logic.
- Not back-filling all historical failed gift sends — only Gayla. If you want me to resend the other failed comps (5-21 "Friend gift", 5-21 "Founder Gift" x2, 5-21 "Potential Enterprise"), say the word and I'll do those too in the same pass.
