## Android ⇄ iOS workflow parity — plan

Comparison of the Android and iOS code paths found the boot, splash, status-bar, keyboard, safe-area, push-registration, deep-link listener, and root-route redirect are already platform-generic and fire identically. Real divergences remaining are three focused items. Fixing them brings Android's user-visible workflow to parity with iOS without touching any legitimate platform-specific plumbing (APNs vs FCM, StoreKit vs Play Billing APIs, etc.).

### Gap 1 — Google Play IAP receipt reliability (highest impact)

iOS persists every purchase to `localStorage` under `pendingAppleReceipts.v1` *before* calling the backend, then drains the queue on boot (via `capacitorInit.ts`), on `appStateChange` foreground resume, and after sign-in/token-refresh. A charged-but-un-validated purchase self-heals. Google Play has none of this — `googlePlayPurchase.ts` calls `validate-google-receipt` inline and throws a "contact support" error on failure.

**Mirror the Apple pattern on Android:**

- Add `src/lib/googlePlayReceiptQueue.ts` exposing `enqueuePendingGoogleReceipt(entry)`, `drainPendingGoogleReceipts()`, and a `PENDING_KEY = "pendingGoogleReceipts.v1"` — structurally identical to the Apple counterpart in `iapPurchase.ts`.
- In `src/lib/googlePlayPurchase.ts`, `enqueue` the `{ purchaseToken, productId, packageName, userId, kind }` payload *before* calling `validate-google-receipt`. On success, remove from queue. On failure, leave it in place and swallow the throw into a friendlier "we'll finish this shortly" message.
- In `src/lib/capacitorInit.ts`, add an `isAndroidNative()` branch parallel to the existing `isIOSNative()` block that:
  - Calls `drainPendingGoogleReceipts()` 2.5s after boot.
  - Registers the same `App.addListener('appStateChange', ...)` foreground-resume drain.
  - Registers the same auth-state drain hook.
- Server-side: add a `google_iap_grants` idempotent ledger table (`{ id, user_id, purchase_token UNIQUE, product_id, granted_at, source }`) and have `validate-google-receipt` insert on that unique key before mutating `circles`/`user_plans`. On conflict → return the prior grant unchanged. This mirrors `apple_iap_grants` and makes client retries safe.

### Gap 2 — Android App Links / email-verify deep-link handoff

`public/.well-known/assetlinks.json` still contains `REPLACE_WITH_PLAY_APP_SIGNING_SHA256` / `REPLACE_WITH_UPLOAD_KEY_SHA256`. Android will not verify the App Link → email verification email opens Chrome instead of the app; iOS is unaffected because AASA has real values.

- This is a user-supplied secret (the SHA-256 fingerprints only exist in Play Console → App integrity → App signing), so the fix cannot be silently coded. Instead:
  - Confirm the previous checklist lines in `scripts/android-post-sync.sh` (added last turn) are still present.
  - Add a build-time script `scripts/check-assetlinks.mjs` invoked from `android-post-sync.sh` that fails loudly (non-zero exit) if `assetlinks.json` still contains any `REPLACE_WITH_` placeholder, blocking the AAB from being uploaded with unverified App Links.
  - Add one line to `README.md` (or the Android section of it, wherever the release checklist lives) with the exact two fingerprint locations in Play Console.
- No JSON auto-edit — user must paste real values themselves.

### Gap 3 — Receipt PDF export on Android WebView

`src/pages/ReceiptHistory.tsx:60` gates the native Filesystem-write + Share sheet on `Capacitor.getPlatform() === "ios"`. Android native drops into the browser `<a href=blob download>` path, which typically no-ops silently inside the Android WebView (no user feedback, no file saved).

- Broaden the branch to `Capacitor.isNativePlatform()` so Android also gets the Filesystem+Share treatment. `@capacitor/filesystem` and `@capacitor/share` already work on Android; no new dependency.

### Cosmetic — iOS-flavored push message strings

`src/lib/pushNotifications.ts` messages say "iOS Settings" / "iOS did not return an APNs token" even on Android. The workflow itself is already platform-generic; only the user/log copy needs to branch on `Capacitor.getPlatform()` to say "Android Settings" / "This device did not return a push token" when appropriate. Small quality-of-life fix, no functional change.

### Explicitly NOT changed

- No changes to Capacitor plugin versions, Gradle files, or MainActivity.
- No changes to splash timing, boot sequence, or root-route redirect (already at parity).
- No changes to iOS code paths.
- No changes to `capacitor.config.ts`.
- No secret injection into `assetlinks.json` — the user pastes fingerprints, the script only enforces they're not placeholders.

### Files changed

- `src/lib/googlePlayReceiptQueue.ts` (new)
- `src/lib/googlePlayPurchase.ts` (enqueue-before-validate, friendlier failure copy)
- `src/lib/capacitorInit.ts` (Android drain branch + listeners)
- `supabase/functions/validate-google-receipt/index.ts` (write to ledger before mutating plans)
- `supabase/migrations/<new>.sql` (create `google_iap_grants` table with GRANTs + RLS)
- `scripts/check-assetlinks.mjs` (new — placeholder check)
- `scripts/android-post-sync.sh` (call the checker)
- `src/pages/ReceiptHistory.tsx` (broaden native branch)
- `src/lib/pushNotifications.ts` (message copy only)

### User steps after merge

```
bash scripts/pull-updates.sh
# Paste real SHA-256s into public/.well-known/assetlinks.json (from Play Console)
npm run build && npx cap sync android && bash scripts/android-post-sync.sh
# (post-sync will now fail if fingerprints are still placeholders)
npx cap open android   # rebuild signed AAB → upload
```

Result: Android email-verify links open the app, Android purchases self-heal the same way iOS purchases already do, Android PDF exports actually save/share, and push copy no longer says "iOS" on Android.