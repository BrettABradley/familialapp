## What actually happened

Apple charged your test purchase, but our backend got `401 Unauthenticated` from Apple **production** (sandbox responded normally). That fingerprint means the API key you generated is a **"Sandbox Testing" key**, not a full **App Store Server API** key — Sandbox Testing keys are only authorized against Apple's sandbox endpoint and always fail on production.

Our code correctly refused to credit seats from an unverifiable receipt (we never trust a client-supplied JWS without verifying it against Apple), which is why you got the "contact support" message. That's the right security behavior — but the UX and operator tooling around it need work.

## Plan

### 1. Credit you immediately
You own one circle (`Smith`, currently 8 + 14 extra = 22 cap). Add the 7 seats from the charged purchase:
- Bump `circles.extra_members` from 14 → 21 on the `Smith` circle.
- Insert a corresponding row into `apple_iap_grants` so the ledger reflects the manual credit (marked `source: 'manual_support_credit'`, referencing transaction `360003156596…`) — prevents accidental double-credit if Apple ever does verify the same txn later.

### 2. Tighten the "verification failed" UX
Right now the user sees a long support email message buried in a toast. Improve:
- Detect `code: APPLE_CREDENTIALS_INVALID` and `APPLE_TXN_NOT_FOUND` on the client and show a dedicated dialog: "Your payment was received by Apple. We'll finish crediting your seats automatically — usually within a few minutes. You can close the app safely."
- Stop saying "contact support" as the first line — only show that after 3+ failed retries from the pending queue.
- Add a "Retry now" button on the dialog that re-drains the pending receipt queue immediately instead of waiting for next launch.

### 3. Add an admin "force-credit" tool
For exactly this case (Apple charged, our backend can't verify):
- New admin-only page `/admin/iap-credits` listing entries from `pendingAppleReceipts` reported via a new `report-pending-receipt` edge function (client uploads its local queue when it sees `APPLE_CREDENTIALS_INVALID`).
- Admin clicks "Verify & credit" → calls `validate-apple-receipt` again (in case creds are now fixed), or "Manual credit" → bumps seats / activates subscription and writes a `manual_support_credit` ledger row.
- Restricted to `is_platform_admin(auth.uid())`.

### 4. Capture pending-receipt context server-side
Currently the only record of a failed-but-charged purchase lives in `localStorage` on the user's device. If they uninstall, it's gone. Add:
- New table `unverified_apple_receipts` (transaction_id PK, user_id, product_id, circle_id, kind, last_error_code, attempts, first_seen_at, last_attempt_at).
- `validate-apple-receipt` writes/updates this row whenever Apple verification fails with `credentials`, `not_found`, or `transient`.
- Removed automatically when a later retry succeeds (the existing idempotent ledger insert tells us the txn finally cleared).

### 5. Auto-retry server-side too
A pg_cron job every 15 min picks unverified receipts older than 5 min and re-runs `validate-apple-receipt` (via service-role). Once you fix the Apple credentials, every stuck purchase clears itself without anyone touching the app.

### 6. Surface the real Apple-key fix (not code — instructions for you)
After implementation, I'll give you the exact App Store Connect steps to regenerate the correct key:
- Users and Access → Integrations → **In-App Purchase** tab
- Under **Active** (not "Sandbox Testing"), generate a key with **App Manager** access
- Replace `APPLE_PRIVATE_KEY`, `APPLE_KEY_ID`, `APPLE_ISSUER_ID` with the new values

Once those creds are in, the cron job from step 5 will retro-verify every charged-but-stuck receipt automatically.

## Files touched

- **Migration:** new `unverified_apple_receipts` table + cron job
- **Edge function:** `supabase/functions/validate-apple-receipt/index.ts` — record/clear unverified receipts
- **New edge function:** `supabase/functions/report-pending-receipt/index.ts` — client uploads its local queue
- **New edge function:** `supabase/functions/admin-credit-receipt/index.ts` — admin manual credit / retry
- **Client:** `src/lib/iapPurchase.ts` — better error mapping, upload pending receipts to server
- **Client:** Purchase UI — replace toast with the new dialog + "Retry now" button
- **New page:** `src/pages/AdminIapCredits.tsx`
- **Data fix:** `circles.extra_members` 14 → 21 on Smith + `apple_iap_grants` insert

## Out of scope (deliberately)

- Trusting client-supplied JWS as a fallback when Apple is unreachable. That's a free-seats exploit waiting to happen and our memory already says don't do this.
- Refunding via Stripe — this is an Apple IAP, refunds go through Apple.

Approve and I'll build it.
