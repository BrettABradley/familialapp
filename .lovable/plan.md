
## Problem

Apple IAP is wired up only on the landing **Pricing** page (free → Family/Extended). Every other paid action still opens Stripe Checkout in the in-app browser, which violates App Store guideline 3.1.1:

| Entry point | File | Currently does |
|---|---|---|
| `/upgrade` — Free → Family/Extended | `UpgradePlanDialog.tsx` | Stripe Checkout |
| `/upgrade` — Family → Extended (preview-then-upgrade) | `UpgradePlanDialog.tsx` → `preview-upgrade` / `upgrade-subscription` | Stripe API |
| `/upgrade` — Add 7 Extra Members ($5 one-time) | `UpgradePlanDialog.tsx` | Stripe Checkout |
| Circle takeover ("Rescue") | `CircleRescueDialog.tsx` | Stripe Checkout |
| Settings → "Manage Billing" | `SubscriptionCard.tsx` | Stripe Customer Portal |
| Pricing page IAP **fallback** | `Pricing.tsx` | Falls through to Stripe if IAP throws |

## Goal

On iOS native (`isIOSNative()`): every paid action uses Apple IAP. No Stripe URL ever opens in the iOS app. Web behavior is unchanged.

## Changes

### 1. Add the Extra Members consumable product
- Add `extraMembers: "com.familialmedia.familial.extramembers"` to `APPLE_PRODUCTS` in `src/lib/iapPurchase.ts`.
- Add a `purchaseConsumable(productId)` helper alongside `purchaseSubscription`, calling `NativePurchases.purchaseProduct` with `PURCHASE_TYPE.CONSUMABLE` and posting the receipt to `validate-apple-receipt` with a `kind: "extra_members"` flag.
- **You must create this consumable in App Store Connect** with the same product ID before TestFlight.

### 2. UpgradePlanDialog (`src/components/circles/UpgradePlanDialog.tsx`)
- At the top of `handleCheckout` and `handleUpgradePreview`/`handleConfirmUpgrade`, branch on `isIOSNative()`:
  - **Subscription options** (Family, Extended, Family→Extended upgrade): call `purchaseSubscription(APPLE_PRODUCTS[plan])`. Apple handles upgrade proration automatically when the new product is in the same subscription group, so the Family→Extended path skips the `preview-upgrade` confirmation dialog on iOS and goes straight to Apple's sheet.
  - **Extra Members**: call the new `purchaseConsumable(APPLE_PRODUCTS.extraMembers)`.
- On success, refresh `user_plans` / circle row and close the dialog.

### 3. CircleRescueDialog (`src/components/circles/CircleRescueDialog.tsx`)
- In `handleTakeOver`, on iOS call `purchaseSubscription(APPLE_PRODUCTS.family)` and pass `circleId` / `rescue_circle_id` to `validate-apple-receipt` so the backend can transfer ownership the same way the Stripe webhook currently does.
- Web path unchanged.

### 4. SubscriptionCard (`src/components/settings/SubscriptionCard.tsx`)
- In `handleManageBilling`, branch on `isIOSNative()` and call `openAppleSubscriptionManagement()` (already exists in `iapPurchase.ts`) instead of `customer-portal`.
- Hide or relabel Cancel/Downgrade buttons when the active subscription was purchased via Apple, since those must be managed in Apple's subscription page. Detect via a new `source` column (`'apple' | 'stripe'`) on `user_plans` set by `validate-apple-receipt`.

### 5. Pricing.tsx — remove Stripe fallback on iOS
- Lines 253–260 silently fall through to Stripe if the IAP plugin throws. On iOS native, surface an error toast instead so we never open Stripe in the iOS app.

### 6. `validate-apple-receipt` edge function
- Extend to accept `kind: "extra_members" | "subscription"` and `circleId` / `rescue_circle_id`.
- For `extra_members`: increment `circles.extra_members` by 7 for the given `circleId`.
- For `rescue_circle_id`: call `claim_circle_ownership(rescue_circle_id)` after activating the subscription.
- Add a `source = 'apple'` write to `user_plans` so the UI can hide Stripe-only management actions.

### 7. DB migration
- Add `source TEXT DEFAULT 'stripe'` column to `user_plans` (values: `'stripe' | 'apple'`).

## Out of scope
- Web Stripe flow stays as-is.
- No webhook changes needed for Stripe.

## Technical notes
- `isIOSNative()` already exists and gates all branches.
- `@capgo/native-purchases` is already installed; no new packages.
- Apple IAP "upgrade in same subscription group" handles proration natively — no preview UI needed on iOS.
- Restore Purchases is already wired in `Pricing.tsx`; no change.

## You'll need to do (App Store Connect, manual)
1. Create consumable product `com.familialmedia.familial.extramembers` ($4.99) in App Store Connect.
2. Confirm `family.monthly` and `extended.monthly` are in the same subscription group so Family→Extended upgrades work as a level change.
