## Harden Android user flow — mirror iOS parity, remove crash-prone Stripe fallbacks

The iOS flow is stable because every purchase / restore / manage / push branch is explicitly gated to `isIOSNative()` **and** routed to StoreKit. On Android, most of those same branches silently fall through the iOS gate and hit the Stripe path — which either fails Play policy 3.4, forces a `window.location.href = stripeUrl` out of the WebView (looks like a crash), or leaves the user stuck.

The `src/lib/mobilePurchase.ts` facade already routes Apple ⇄ Google correctly. It's just barely used — most call sites import `iapPurchase` (Apple) directly. This plan routes every purchase surface through the facade so Android automatically gets the Play Billing path with the same hardened queue + retry the last turn added.

### Gap A — `src/pages/Auth.tsx` post-signup purchase (line 187-210)

`if (isIOSNative()) { purchaseSubscription(APPLE_PRODUCTS...) } else { create-checkout → window.location.href = data.url }`. On Android native, the else branch tries to leave the WebView for a Stripe URL — Play reviewers reject this as broken.

Fix: replace with `mobilePurchase.productIdFor(plan)` + `mobilePurchase.purchaseSubscription(id)`. Fall through to Stripe only when `!isMobileNative()` (web).

### Gap B — `src/pages/Circles.tsx` extra-members button (line 1011-1030)

Same pattern for the consumable. Route through `mobilePurchase.purchaseConsumable(productIdFor('extraMembers'))`. Web-only fallback to Stripe.

### Gap C — `src/components/landing/Pricing.tsx` (lines 117, 254, 336, 504, 610, 620)

Six iOS-only gates:
- **117** — StoreKit prewarm useEffect. Also prewarm Google on Android via facade.
- **254** — Upgrade click iOS-only branch → widen to any native platform via facade.
- **336, 504** — "Manage in App Store" button. Show "Manage in Google Play" on Android via `openNativeSubscriptionManagement(productId)`.
- **610, 620** — `SubscriptionDisclosure` + "Restore Purchases" button rendered only on iOS. Show both on Android too (Play has similar consumer-disclosure requirements and Restore is needed to trigger the queue drain).

### Gap D — `src/pages/Settings.tsx` (lines 365-371, 413, 630)

- **365-371** — "Manage Subscription (Apple)" button hidden on Android. Add an equivalent Google button that calls `openPlaySubscriptionManagement(productId)` when `isAndroidNative()`.
- **413** — push toggle re-registers only on iOS. Widen to `isMobileNative()` so Android push registration also fires when the user re-enables the toggle.
- **630** — "Download My Data" uses `Filesystem+Share` on iOS only; Android falls to `<a download>` which no-ops in the WebView (same bug pattern we already fixed for ReceiptHistory last turn). Broaden to `isMobileNative()`.

### Gap E — `src/components/circles/CircleRescueDialog.tsx` (lines 47, 101, 171)

- **47** — prewarm iOS-only. Widen via facade.
- **101** — Take-Over purchase iOS-only; Android falls to Stripe. Widen via facade.
- **171** — `SubscriptionDisclosure` shown iOS-only. Render on Android too.

### Gap F — `src/components/circles/UpgradePlanDialog.tsx` (line 326, 339)

Consumer-disclosure copy + Restore/Manage row iOS-only. Mirror on Android.

### Gap G — `src/components/settings/SubscriptionCard.tsx` (line 116-127)

Already correct (iOS → App Store, Android → Play, web → Stripe portal). No change — keep as reference implementation.

### Cross-cutting hardening

- **Wrap every dynamic `import("@capgo/capacitor-purchases")`** load in a try/catch that logs and returns `false`, so a missing/broken plugin on Android can never propagate an unhandled rejection to `window.addEventListener('unhandledrejection')` in `main.tsx` (which Play could log as an error).
- **`openExternalUrl` guard** — audit calls that pass Stripe URLs on native mobile; on native, route through `@capacitor/browser` (in-app browser tab) instead of `window.location.href`, so a Stripe fallback that DOES fire (e.g. web-purchased plan managed inside the Android app) opens a Custom Tab instead of tearing the WebView down.
- **Startup drain**: last turn already added the Google receipt queue drain to `capacitorInit.ts`. Confirm it stays on the boot path.

### Explicitly NOT changed

- No refactor of `mobilePurchase.ts` shape — call sites just start using it.
- No changes to native project files (`android/`, `ios/` — not in repo).
- No changes to `capacitor.config.ts`, splash timing, status bar, keyboard, or push-registration bridge.
- No changes to `iapPurchase.ts`, `googlePlayPurchase.ts`, or the `google_iap_grants` ledger.
- No changes to iOS-only visuals (App Store button label stays as-is when on iOS).

### Files changed

- `src/pages/Auth.tsx`
- `src/pages/Circles.tsx`
- `src/pages/Settings.tsx`
- `src/components/landing/Pricing.tsx`
- `src/components/circles/CircleRescueDialog.tsx`
- `src/components/circles/UpgradePlanDialog.tsx`
- `src/lib/googlePlayPurchase.ts` (try/catch around plugin dynamic import)
- Possibly one small helper in `src/lib/mobilePurchase.ts` if a shared "open subscription management with productId lookup" wrapper reduces duplication.

### Expected outcome

- Every Android purchase surface routes through Play Billing, not Stripe — no more WebView-crashing `window.location.href` handoff.
- Restore + Manage buttons work on Android, letting users recover from a queued receipt without a support ticket.
- Push-permission toggle actually re-registers on Android.
- Native file exports (Download Data, Receipts) use the share sheet on Android instead of silently failing.
- All plugin loads are try/catch-guarded so a corrupted `@capgo/capacitor-purchases` install on a specific device can't hard-crash the app.