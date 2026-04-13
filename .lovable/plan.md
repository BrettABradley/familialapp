

# Switch to Free IAP Plugin (@capgo/capacitor-native-purchases)

## What Changes
Replace the paid `@capawesome/capacitor-in-app-purchases` plugin with the free, open-source `@capgo/capacitor-native-purchases` plugin. Same StoreKit 2 functionality, zero cost.

## Steps

### 1. Install the free plugin
Add `@capgo/capacitor-native-purchases` as a dependency (it's on the public npm registry).

### 2. Rewrite `src/lib/iapPurchase.ts`
Update all dynamic imports and API calls to use the new plugin's API:

- `NativePurchases.isBillingSupported()` to check availability
- `NativePurchases.getProducts()` with `productType: PURCHASE_TYPE.SUBS`
- `NativePurchases.purchaseProduct()` for purchasing
- `NativePurchases.getPurchases()` for restore
- `NativePurchases.finishTransaction()` to complete

The dynamic import pattern stays the same (avoids web build errors), just targeting `@capgo/native-purchases` instead.

### 3. No other files change
`Pricing.tsx`, `validate-apple-receipt`, and everything else stays the same — they only call `purchaseSubscription()` and `restorePurchases()` from `iapPurchase.ts`.

### Local Setup (unchanged)
After pulling, the user still needs to run `npx cap sync ios` to register the native plugin.

## Files Changed

| Type | File |
|------|------|
| Updated | `src/lib/iapPurchase.ts` — swap plugin import and API calls |
| Updated | `package.json` — add `@capgo/capacitor-native-purchases` |

