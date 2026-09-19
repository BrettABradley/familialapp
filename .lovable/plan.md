# Fix the Android crash on launch

## What I found

The app has **two different in-app-purchase add-ons installed at the same time**, and one of them is built for a much older version of the mobile framework than the one the app uses.

- `@capgo/native-purchases` (v8) — modern, matches the app, already used for Apple purchases.
- `@capgo/capacitor-purchases` (v5) — old, states it only supports framework version 5 while the app runs version 8. It also bundles a different payment provider's SDK (RevenueCat) that the app never sets up.

Everything installed like this gets compiled into the Android app and started automatically the moment the app opens — before any of our own screens run. An add-on built against an incompatible framework version is the classic cause of "the app closed because it has a bug" immediately on launch, which is exactly what Google reported. On iPhone this add-on is never loaded, which explains why Apple sees no crashes.

Secondary issue: because that old add-on expects RevenueCat setup that never happens, Android purchases could not have worked correctly even if the app opened.

## The fix

1. Remove the outdated `@capgo/capacitor-purchases` add-on entirely.
2. Rewrite the Google Play purchase code to use the same modern add-on already powering Apple purchases. It fully supports Google Play (Billing 8), returns the Google purchase token our server already expects, and keeps the existing pending-purchase queue, retry, and restore behavior unchanged.
3. Keep every product ID, backend call, and user-facing message exactly as it is today, so nothing else about buying changes.
4. Replace the Google Play "manage subscription" link so it opens through the in-app browser instead of a plain popup, which can silently do nothing inside the Android app.
5. Bump the Android version so a fresh build can be uploaded.

## Also worth flagging (not part of the crash fix unless you want it)

- `public/.well-known/assetlinks.json` still contains placeholder text instead of your real Play signing fingerprints, so email verification links will open in Chrome rather than the app. I can wire in the real values once you paste them from Play Console.

## Technical detail

- `bun remove @capgo/capacitor-purchases`.
- Rewrite `src/lib/googlePlayPurchase.ts` against `@capgo/native-purchases`: `getProducts({ productIdentifiers })`, `purchaseProduct({ productIdentifier, productType: PURCHASE_TYPE.SUBS | INAPP })`, read `transaction.purchaseToken`, `restorePurchases()`.
- Keep `enqueuePendingGoogleReceipt` / `submitGoogleReceipt` / `drainPendingGoogleReceipts` wiring and `google_iap_grants` idempotency untouched.
- Swap `window.open` in `openPlaySubscriptionManagement` for `openInAppBrowser` from `src/lib/externalUrl.ts`.
- Run `node scripts/bump-android-version.mjs`.
- Verify with `bunx tsgo --noEmit -p tsconfig.app.json`.

## After I ship it

Run on your machine:

```bash
bash scripts/pull-updates.sh
npx cap sync android
npx cap open android
```

then build a signed AAB and upload it.
