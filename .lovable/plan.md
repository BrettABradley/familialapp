## Harden residual Stripe fallback on native Android

The audit confirms all Android purchase surfaces now correctly route through Google Play Billing via the `mobilePurchase` facade — the main flow is solid. This plan closes the last edge case: a web-subscribed user opening the Android app and hitting a Stripe URL.

### Findings from the audit

- **All primary purchase paths** (`Auth.tsx`, `Circles.tsx`, `Pricing.tsx`, `CircleRescueDialog.tsx`) gate on `isMobileNative()` and use the facade before ever touching `create-checkout`. ✅
- **Manage / Restore / Disclosure** rendered for both iOS and Android. ✅
- **Push toggle** re-registers on any native platform. ✅
- **Plugin loads** are try/catch-wrapped. ✅
- **Receipt queue** enqueue-before-submit + drain on launch/resume/restore matches Apple. ✅

### The residual risk

Two Stripe-URL escape hatches remain on paths reachable inside the Android WebView:

1. **`src/pages/Auth.tsx` line 221** — `window.location.href = data.url` on web-only branch, but a defense-in-depth swap to `openExternalUrl` is cheap and prevents future regressions if the guard is ever removed.
2. **`src/lib/externalUrl.ts`** — on Android, `openExternalUrl` tries `App.openUrl` first (launches Chrome and leaves the app entirely). For Stripe specifically we want **Chrome Custom Tabs** (`@capacitor/browser`) so the payment flow returns cleanly to the app without an OS task-switcher trip.

### Changes

**`src/lib/externalUrl.ts`**
- Add a new helper `openInAppBrowser(url)` that:
  - On native (iOS + Android): calls `@capacitor/browser` `Browser.open({ url, presentationStyle: 'fullscreen' })` directly. This gives Custom Tabs on Android and SFSafariViewController on iOS — both return to the app cleanly after Stripe completes.
  - On web: `window.open(url, '_blank')`.
- Leave existing `openExternalUrl` untouched (still used for non-return links like Stripe portal from within Settings where the user may want to leave).
- Wrap `Browser.open` in try/catch so a plugin failure falls back to `window.open` instead of throwing.

**`src/pages/Auth.tsx`** (line 221)
- Replace `window.location.href = data.url` with `await openInAppBrowser(data.url)` (still web-only path, but no more raw location assignment).

**`src/pages/Circles.tsx` (line 1042), `src/components/circles/CircleRescueDialog.tsx` (line 132), `src/components/landing/Pricing.tsx` (line 310)**
- Audit each remaining `openExternalUrl(data.url)` for Stripe checkout URLs and swap to `openInAppBrowser` so a web-purchased user opening the Android app gets Custom Tabs instead of a Chrome hand-off.

### Explicitly NOT changing

- No changes to the Google Play Billing flow, receipt queue, or `mobilePurchase` facade.
- No changes to iOS behavior beyond swapping which browser presentation the Stripe URL uses (SFSafariViewController via Browser.open was already the fallback).
- No changes to `openMapsApp`, `Manage in Play` deep links, or same-origin `window.location.href` uses (`/auth` redirects, update reloads).
- No native project or `capacitor.config.ts` changes.

### Expected outcome

- Android web-subscribed users opening Stripe inside the app get a Custom Tab that returns cleanly — no WebView tear-down, no Chrome task-switch, no perceived crash.
- iOS behavior is unchanged in practice (still SFSafariViewController).
- Zero regression risk to the native IAP flow — none of it goes through these paths.
