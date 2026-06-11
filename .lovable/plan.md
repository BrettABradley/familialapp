## Diagnosis

The screenshot error means StoreKit returned a transaction to the app, then our backend failed while trying to verify/credit it.

The backend logs confirm the exact cause:

```text
validate-apple-receipt
kind: extra_members
productId: com.familialmedia.familial.extramembers
transactionId: 360003156574…
Apple production 401: Unauthenticated
Apple sandbox 401: Unauthenticated
```

So this is not a UI problem. The iOS app is calling the receipt-validation function, but Apple is rejecting our App Store Server API credentials. That is why **all iOS IAPs** can show “Purchase failed” after the Apple sheet.

## Plan

### 1. Credit Londa immediately
Credit the Reina Bible Study circle manually with the Extra Members add-on:

- Circle: `Reina Bible Study`
- Current: `4/8 members`
- Add-on: `+7 seats`
- Result: `4/15 members`

This should be done even if we later confirm Apple did not charge her, since you specifically want her credited.

### 2. Fix the real IAP failure
The backend has Apple credential secrets present, but Apple is rejecting them with `401 Unauthenticated`. I will update the IAP verification flow so failures are clearer and easier to diagnose, but the root fix is that the Apple App Store Server API credentials must be valid.

Likely issue:

- The current `APPLE_PRIVATE_KEY`, `APPLE_KEY_ID`, or `APPLE_ISSUER_ID` is wrong, expired/revoked, copied incorrectly, or not an App Store Connect API key with App Store Server API access.
- A Sign in with Apple key will not work for App Store purchase verification.

Required Apple credentials:

- App Store Connect API Key `.p8`
- Key ID
- Issuer ID
- Access level that can call App Store Server API

### 3. Improve backend error handling
Update `validate-apple-receipt` so Apple `401` returns a support-grade message instead of a generic “couldn’t add seats” message.

New behavior:

- If Apple rejects credentials: return `APPLE_CREDENTIALS_INVALID`.
- If Apple is temporarily unavailable: return retryable error.
- If transaction verifies: credit the plan/seats.
- If duplicate transaction: do not double-credit.

### 4. Add an idempotent IAP grant ledger
Create a new table such as `apple_iap_grants` to record successful Apple IAP grants.

It will track:

- user ID
- circle ID when relevant
- product ID
- transaction ID
- original transaction ID
- grant type: subscription or extra members
- seats added
- created timestamp

This prevents duplicate credits when the app retries.

### 5. Add a local pending receipt retry queue
Update the iOS client so once StoreKit returns a transaction ID, the app saves it locally before calling the backend.

If backend verification fails because of network, credentials, or app backgrounding:

- The receipt stays queued.
- The app retries on next launch/resume.
- The user sees: “Purchase received. We’ll retry crediting automatically.”

### 6. Fix all iOS IAP purchase paths
Apply the same reliability pattern to:

- Extra Members one-time add-on
- Family subscription
- Extended subscription
- Restore Purchases

### 7. Refresh UI after credit
After a successful IAP credit:

- Refresh circles/profile/plan data.
- Update the visible member cap immediately.
- Show a clear success toast.

## What I need during implementation

If the current Apple secrets are wrong, I’ll need you to replace them with the correct App Store Connect API key values. The code can be fixed now, but Apple verification will keep failing until those credentials are valid.