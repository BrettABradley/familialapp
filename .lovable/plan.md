## Android reviewer-crash follow-up — plan

No stack trace exists (Play Console gave a policy notice, not a crash record). Backend signals show no 5xx or auth errors during reviewer activity, so the failure is client-side/native. Previous turn already patched the two boot-time crash risks (conditional Firebase plugin, guarded push init, faster splash, 8s WebView fallback, version 66.0.4). This plan closes the remaining reviewer-visible gaps.

### Focus

1. **Verify Android App Links wiring so the email verification link opens the app.**
   - Read `public/.well-known/assetlinks.json` and confirm `package_name: com.familialmedia.familial` plus at least one `sha256_cert_fingerprints` entry.
   - If the release-keystore fingerprint is missing or unknown, add a placeholder entry + inline instructions so the user can paste in the fingerprint from Play Console → App integrity → App signing → "SHA-256 certificate fingerprint" without hunting for the file.
   - Confirm the intent-filter injected by `scripts/android-post-sync.sh` targets both `familialmedia.com` and `www.familialmedia.com` with `pathPrefix="/auth/callback"` and `android:autoVerify="true"` (it already does — no change).

2. **Harden `AuthCallback` for the case where the email link opens in the Android browser instead of the app.**
   - Verify `src/pages/AuthCallback.tsx` still completes the PKCE exchange from the URL if the user lands there in Chrome (not the WebView). If it currently only works inside the Capacitor shell, add a browser-safe fallback so at minimum the user gets a "Open in Familial" button + a clear next-step message.

3. **Explicit missing-FCM diagnostic on Android.**
   - In `src/lib/pushNotifications.ts`, when `Capacitor.getPlatform() === 'android'` and the register call throws a `FirebaseApp` error, log a single distinctive line (`[push] android-fcm-not-configured — google-services.json missing`) so the next reviewer build's `adb logcat` immediately identifies the cause. No behavior change — it already fails silently.

4. **README / user-facing setup doc snippet in `scripts/android-post-sync.sh`.**
   - Add one extra line to the pre-upload checklist reminding the user to (a) confirm `assetlinks.json` fingerprint matches the release keystore, and (b) test the email verification link on a physical device before uploading.

5. **No native code, no plugin bumps, no DB or edge-function changes.** Everything above is either documentation, a JSON edit, or a log line.

### Files touched

- `public/.well-known/assetlinks.json` — verify/patch fingerprints structure only
- `src/pages/AuthCallback.tsx` — browser-safe fallback path (small conditional)
- `src/lib/pushNotifications.ts` — one extra diagnostic log line on Android FCM failure
- `scripts/android-post-sync.sh` — two extra checklist lines

### Explicitly NOT changed

- No modification to Capacitor config, Gradle, MainActivity, or plugin versions.
- No auth-flow or session logic changes.
- No changes to `src/main.tsx`, `index.html`, or splash timing (already done last turn).
- No version bump — 66.0.4 from last turn is still the target AAB.

### After merge — user steps

```
bash scripts/pull-updates.sh
# Get release SHA-256 from Play Console → App integrity → App signing
# Paste it into public/.well-known/assetlinks.json (if missing)
npm run build && npx cap sync android && bash scripts/android-post-sync.sh
npx cap open android   # rebuild signed AAB → upload
```

Once uploaded, the reviewer's verification email link will open directly in the app on Android, closing the most likely "app does not open or load" path.