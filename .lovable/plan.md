## Why Stripe still appears on iOS

Two code paths bypass the iOS guard and call Stripe directly. Both will fire in TestFlight / App Review:

### 1. `src/pages/Auth.tsx` (line 62–78) — the likely culprit
When the landing page sends a user to `/auth?plan=family` (or `?plan=extended`), after they log in this `useEffect` calls `create-checkout` and does `window.location.href = data.url` → opens Stripe. **No `isIOSNative()` check.** This is the most common path a reviewer would hit: tap "Get Family Plan" on the landing page, sign in, get sent to Stripe.

### 2. `src/pages/Circles.tsx` (line 999–1018) — "Add 7 Extra Members — $5" button
The button in the Members dialog calls `create-checkout` directly with no iOS guard. On iOS this opens Stripe instead of the Apple IAP consumable.

Everything else (`Pricing.tsx`, `UpgradePlanDialog`, `CircleRescueDialog`, `SubscriptionCard`) is already correctly iOS-gated.

## Fix

### A. `src/pages/Auth.tsx` — gate the post-login plan checkout
In the `useEffect` at line 62, before calling `create-checkout`, branch on `isIOSNative()`:
- On iOS: `await purchaseSubscription(APPLE_PRODUCTS[planParam])`, then on success refresh `user_plans` and navigate to `/circles`. On error/cancel, show toast and navigate to `/circles`.
- On web: keep existing Stripe checkout flow.

### B. `src/pages/Circles.tsx` — gate the "Add 7 Extra Members" button
In the onClick at line 1002, branch on `isIOSNative()`:
- On iOS: `await purchaseConsumable(APPLE_PRODUCTS.extraMembers, { circleId: selectedCircle.id, kind: "extra_members" })`, then refresh circle row and toast success.
- On web: keep existing Stripe `create-checkout` payment flow.

Both already have the helpers available — `purchaseSubscription`, `purchaseConsumable`, `APPLE_PRODUCTS`, and `isIOSNative` are all exported from `src/lib/iapPurchase.ts`.

## After the fix

Rebuild iOS, push to TestFlight. Once products flip to "Approved" (post-Apple-review), the same flows will trigger the native Apple sheet instead of Stripe. No web behavior changes.

## Out of scope
- No edge function changes needed (`validate-apple-receipt` already supports both `subscription` and `extra_members` kinds).
- No DB changes.
