
# Android Build Plan — Familial

Goal: ship the Android version of Familial with feature parity to iOS and web. Every iOS-only branch in the codebase gets an Android equivalent; the web build is untouched. Nothing in the existing iOS pipeline (`scripts/ios-post-sync.sh`, `cap:sync:ios`, IAP, push, deep links, auth) changes.

The native Android project lives in `android/` and is checked into the user's local GitHub repo, not the Lovable sandbox (mirrors how iOS is handled today). All Lovable-side work is JS/TS, edge functions, and a new `scripts/android-post-sync.sh` that runs after `npx cap sync android`.

---

## 1. Capacitor platform setup

- Verify `@capacitor/android` is already installed (it is, `^8.2.0`) — no new deps for the base platform.
- Add npm scripts that mirror the iOS ones:
  - `cap:sync:android` → `npx cap sync android && sh scripts/android-post-sync.sh`
  - Update the existing `capacitor:sync:after` / `capacitor:copy:after` / `capacitor:update:after` hooks to run both iOS and Android post-sync scripts (guarded by `[ -d ios ]` / `[ -d android ]` so each is a no-op when that platform isn't present).
- `capacitor.config.ts`: no breaking change. Add an `android` block:
  - `android.allowMixedContent: false`
  - `android.captureInput: true`
  - `android.webContentsDebuggingEnabled: false` (true only in dev builds)
  - Keep existing `appId: 'space.manus.familial.mobile.t20260223211425'` so both platforms share the same identifier family.
- User-side bootstrap (documented in the closing message, not code): `npx cap add android` → `npx cap sync android` → open in Android Studio.

---

## 2. Platform-detection layer (code parity)

Today the codebase uses `isIOSNative()` from `src/lib/iapPurchase.ts` in 30+ places. We extend, do not replace:

- New file `src/lib/platform.ts` exporting:
  - `isIOSNative()` (re-exported from existing source for back-compat)
  - `isAndroidNative()` → `Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'`
  - `isMobileNative()` → either of the above
  - `isWeb()` → `!Capacitor.isNativePlatform()`
- Existing `isIOSNative` callers stay untouched. New Android branches are added next to them where behavior must differ (billing, subscription management URL, push channel registration).
- `src/lib/externalUrl.ts` gets an Android branch for map deep links (`geo:` intent URI) alongside the existing iOS `maps://` / `comgooglemaps://` branch.

---

## 3. Google Play Billing (replaces Apple IAP on Android)

Apple StoreKit cannot run on Android, and Google Play requires Play Billing for any digital goods consumed in-app. We add a parallel implementation, keep the existing iOS one intact.

- Library: `@capgo/capacitor-purchases` (Play Billing v6 wrapper from the same vendor as our existing `@capgo/native-purchases`). This avoids introducing a second SDK paradigm.
- New file `src/lib/googlePlayPurchase.ts` mirroring the public surface of `iapPurchase.ts`:
  - `GOOGLE_PRODUCTS` — `family_monthly`, `extended_monthly`, `extra_members` (Play SKU IDs configured in Play Console; do not reuse Apple's reverse-DNS IDs).
  - `prewarmProducts()`, `purchaseSubscription()`, `purchaseConsumable()`, `restorePurchases()`, `openPlaySubscriptionManagement()` (opens `https://play.google.com/store/account/subscriptions?sku=…&package=…`).
- New unified facade `src/lib/mobilePurchase.ts`:
  - Picks Apple vs Google at runtime via `isIOSNative()` / `isAndroidNative()`.
  - All call sites (`Pricing.tsx`, `UpgradePlanDialog.tsx`, `CircleRescueDialog.tsx`, `SubscriptionCard.tsx`, `Auth.tsx`, `Circles.tsx`, `Settings.tsx`, `ReceiptHistory.tsx`) keep calling `purchaseSubscription` / `purchaseConsumable` / `restorePurchases` — but through the facade. iOS code path is unchanged.
- Edge function `supabase/functions/validate-google-receipt/index.ts`:
  - Verifies Play purchase tokens via Google Play Developer API using a service account JSON (new secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`).
  - Same body contract as `validate-apple-receipt` (`kind`, `productId`, `purchaseToken`, optional `circleId`, `rescue_circle_id`).
  - Writes/updates `user_plans` with `source = 'google'` (new enum value — see §8).
  - Handles renewals, refunds, and grace period via Real-time Developer Notifications (next bullet).
- New edge function `supabase/functions/google-play-rtdn/index.ts`:
  - Public webhook (no JWT) that receives Pub/Sub push from Play Console for subscription state changes (renewed, canceled, on hold, paused).
  - Mirrors what `stripe-webhook` and Apple App Store Server Notifications do today.
- `SubscriptionCard.tsx`: extend the existing `isApple` logic so Android users on `source === 'google'` see "Manage in Google Play" and route through `openPlaySubscriptionManagement()` instead of Stripe Customer Portal (matches Play policy 3.4).

---

## 4. Push notifications (FCM)

iOS push uses APNs through `@capacitor/push-notifications`. Android needs Firebase Cloud Messaging.

- Add `google-services.json` (user drops it into `android/app/` after creating the Firebase project — documented in closing message; we cannot generate it).
- `scripts/android-post-sync.sh` injects the Google Services Gradle plugin into `android/build.gradle` and `android/app/build.gradle` if missing (idempotent, like the iOS post-sync).
- `src/lib/pushNotifications.ts`: relax the iOS-only guard. New `registerForPushNotificationsAndroid()` path:
  - Calls `PushNotifications.requestPermissions()` (Android 13+ requires `POST_NOTIFICATIONS` runtime permission — declared in `AndroidManifest.xml` via post-sync script).
  - On `registration` event, the token is an FCM token instead of an APNs token. Upload to the same `push_tokens` table with a new column `platform` (`ios` | `android`).
- Edge function `supabase/functions/send-push-notification/index.ts`:
  - Branch on `platform`. For `android` rows, call FCM HTTP v1 (`https://fcm.googleapis.com/v1/projects/<project>/messages:send`) with an OAuth bearer from the same service account JSON used in §3.
  - Existing Expo/APNs path stays exactly as-is for iOS rows. Both delivery paths run in parallel for users on both devices.
- Notification channels: create a default "Family activity" channel on first registration so Android 8+ shows notifications correctly.

---

## 5. Deep links (App Links)

iOS has `apple-app-site-association`. Android needs Digital Asset Links.

- New file `public/.well-known/assetlinks.json` — generated from the Android signing cert SHA-256 fingerprint (user provides it after the first signed build; we ship a template with a placeholder and clear comments).
- Post-sync script writes an `intent-filter` block into `AndroidManifest.xml` for `https://www.familialmedia.com/auth/callback` and `https://familialmedia.com/auth/callback`, with `android:autoVerify="true"`.
- `useDeepLinkCircleSync.ts` and `AuthCallback.tsx` already use Capacitor `App.addListener('appUrlOpen', …)` patterns — no change needed; they fire on Android the same way once the intent filter is registered.

---

## 6. Native plugins parity audit

Walking the existing plugin set and confirming Android behavior:

| Plugin | iOS today | Android action |
|---|---|---|
| `@capacitor/app` | works | works, no change |
| `@capacitor/browser` | in-app SFSafariViewController | uses Chrome Custom Tabs automatically |
| `@capacitor/camera` | requires NSCameraUsageDescription | post-sync adds `CAMERA`, `READ_MEDIA_IMAGES` (Android 13+), `READ_EXTERNAL_STORAGE` (≤12) to manifest |
| `@capacitor/filesystem` | works | works; `nativeDownload.ts` needs `WRITE_EXTERNAL_STORAGE` for ≤Android 9 — already gated, confirm |
| `@capacitor/haptics` | works | works (uses Vibrator API) |
| `@capacitor/keyboard` | extensive iOS-specific handling in `capacitorInit.ts` | Android keyboard fires the same `keyboardWillShow/Hide` events; existing `--keyboard-height` and `.keyboard-open` logic works. Verify safe-area-inset behavior with `WindowCompat.setDecorFitsSystemWindows(false)` configured in post-sync. |
| `@capacitor/share` | works | works |
| `@capacitor/splash-screen` | configured | add Android 12+ splash via `res/values/styles.xml` post-sync injection; reuse `#ffffff` background |
| `@capacitor/status-bar` | `overlaysWebView: true`, light style | same config works; verify against the dark-on-light theme |
| `@capacitor-community/media` | works | works |
| `capacitor-voice-recorder` | works | requires `RECORD_AUDIO` permission — added by post-sync |
| `@capgo/native-purchases` | iOS only — stays iOS only | replaced by `@capgo/capacitor-purchases` on Android (§3) |

Nothing in the iOS path is removed or modified.

---

## 7. Android post-sync script (`scripts/android-post-sync.sh`)

Mirrors what `ios-post-sync.sh` does. Idempotent. Runs after every `npx cap sync android`. Responsibilities:

- Set `applicationId`, `versionCode`, `versionName` in `android/app/build.gradle` (versionCode auto-bumped from `package.json`'s `version`, like iOS).
- Inject required permissions into `android/app/src/main/AndroidManifest.xml`:
  - `INTERNET`, `POST_NOTIFICATIONS`, `CAMERA`, `RECORD_AUDIO`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `VIBRATE`, `WAKE_LOCK`.
  - `<queries>` block for `geo:`, `mailto:`, `tel:` so external app handoff (Maps, email, phone) works on Android 11+.
- Inject deep-link `intent-filter` (§5).
- Inject FCM service registration + Firebase Gradle plugin (§4).
- Inject Splash + status-bar theme.
- Disable cleartext traffic, set `android:usesCleartextTraffic="false"`.
- Set the app's display name to "Familial" in `strings.xml`.

---

## 8. Database changes

One migration (single approval):

- Add `platform` column to `public.push_tokens` (`text`, default `'ios'`, backfilled to `'ios'` for existing rows). Add composite uniqueness `(user_id, device_token, platform)`.
- Extend the `user_plans.source` enum/text check to allow `'google'` alongside `'stripe'`, `'apple'`, `'admin_comp'`.
- Add `google_purchase_token` and `google_subscription_id` columns to whatever table currently stores Apple `original_transaction_id` (so renewals from RTDN can be matched back to a user/circle).
- New table `public.google_play_events` for raw RTDN payloads (audit/debugging — same role the `apple_notifications` table plays today, if it exists; if not, mirror that pattern).
- All new tables get explicit `GRANT`s + RLS (service-role-only — these are webhook tables).

Admin dashboard's "Paying customers" view (just shipped) gets `source: 'google'` added to its platform badge.

---

## 9. Secrets to add (Lovable Cloud)

To be requested with `add_secret` once the user confirms:

- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` — service account with "View financial data" + "Manage orders and subscriptions" + FCM "Cloud Messaging API" roles.
- `GOOGLE_PLAY_PACKAGE_NAME` — typically `space.manus.familial.mobile.t20260223211425`.
- `FCM_PROJECT_ID` — Firebase project ID for the HTTP v1 endpoint.

No iOS secret is touched.

---

## 10. Build & release pipeline

- Document (in closing message) the user-side steps: `npx cap add android` → `npm run cap:sync:android` → open `android/` in Android Studio → set up signing config → upload AAB to Play Console internal testing.
- Recommend the same `--legacy-peer-deps` flag we already use for iOS sync (memory: `mobile-deployment`).
- Provide a `scripts/android-release.sh` that bumps versionCode, runs `npm run build && npm run cap:sync:android && cd android && ./gradlew bundleRelease`.

---

## 11. QA checklist (parity verification)

Before declaring done, manually verify on a real Android device (Pixel + a Samsung as the two most-rejected by Play review):

1. Auth: email + Google sign-in + 2FA gate.
2. Push: receive notification cold-started, foregrounded, after sign-out/sign-in (token reclaim works).
3. Billing: purchase Family plan, upgrade to Extended, buy extra-members consumable, restore purchases, downgrade, RTDN cancellation.
4. Deep links: paste `https://familialmedia.com/auth/callback?…` into a message and tap — should open the app, not the browser.
5. Camera, photo picker, voice notes, HEIC (Android won't HEIC-encode but should decode).
6. Pull-to-refresh on Feed/Circles.
7. Keyboard: bottom nav not covered, chat input pinned above keyboard, status bar stays light.
8. Subscription management button → opens Play subscriptions page (not Stripe portal, not Apple).
9. Web build (`npm run build` + preview): unchanged — no Capacitor plugin call leaks into web bundle (all are dynamic `await import(...)` already).
10. iOS build (`npm run cap:sync:ios`): regression test — still launches, still buys via StoreKit, still pushes via APNs.

---

## Out of scope

- Tablet-optimized layouts (Material 3 large-screen patterns).
- Wear OS / Android Auto / Android TV.
- Replacing Capacitor with React Native — explicitly not happening.
- Migrating iOS off `@capgo/native-purchases`.

---

## Order of execution

1. Database migration (§8) — needs approval before code can use the new columns.
2. Platform detection layer (§2) + facade (`mobilePurchase.ts`).
3. Google Play billing edge function + client lib (§3).
4. FCM push + `send-push-notification` branch (§4).
5. Post-sync script + manifest/Gradle scaffolding (§7).
6. Deep links (§5).
7. Closing instructions to the user covering `npx cap add android`, Firebase setup, Play Console SKU creation, and signing cert SHA-256 collection.
