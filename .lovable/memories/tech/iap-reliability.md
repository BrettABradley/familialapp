---
name: IAP reliability pattern
description: Apple/Google IAP receipts persisted to localStorage before backend validation; drained on launch/resume; idempotent via apple_iap_grants ledger
type: feature
---

iOS IAP flow in `src/lib/iapPurchase.ts`:

1. After StoreKit returns a transactionId, the receipt is `enqueuePending`-ed to localStorage (`pendingAppleReceipts.v1`) BEFORE calling `validate-apple-receipt`.
2. If validation succeeds → receipt removed from queue, returns `true`.
3. If validation returns a retryable error (code `APPLE_CREDENTIALS_INVALID`, `APPLE_TXN_NOT_FOUND`, `APPLE_TRANSIENT`, or any error) → receipt stays queued; function throws a friendly "saved on this device, will retry" error.
4. `drainPendingIapReceipts()` runs on app launch (2.5s after boot), on every `appStateChange` resume via `@capacitor/app`, and after SIGNED_IN/TOKEN_REFRESHED.

Backend `apple_iap_grants` table (unique index on `transaction_id`) makes credits idempotent — duplicate transaction returns `{ success: true, duplicate: true, added: 0 }` without re-applying.

`validate-apple-receipt` returns structured codes on failure: `APPLE_CREDENTIALS_INVALID` (Apple 401, our App Store Server API key is bad), `APPLE_TXN_NOT_FOUND` (Apple 404), `APPLE_TRANSIENT` (network/5xx). All with `retry: true`.

Manual credits: insert into `apple_iap_grants` with `transaction_id = 'manual-credit-<who>-<date>'` to keep the ledger consistent.
