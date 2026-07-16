## Google Play "Broken Functionality" — diagnosis & fix plan

Google's reviewer saw the app fail to open on install. Given our current Android setup, the most likely crash-on-launch causes are all in the native Android glue, not the web bundle:

### Root cause candidates (highest → lowest likelihood)

1. **Firebase / google-services plugin applied without `google-services.json`.**
   `scripts/android-post-sync.sh` unconditionally appends `apply plugin: 'com.google.gms.google-services'` and the classpath. If a build is produced without `android/app/google-services.json` in place, the app crashes at boot with `Default FirebaseApp is not initialized` the moment `@capacitor/push-notifications` (or FCM) touches Firebase. Reviewer bundles are commonly built this way.
2. **Push registration runs at launch without a session and can throw on Android** if FCM isn't wired, taking down the WebView bridge in some device configs.
3. **Splash overlay held for 2.5s + 0.7s fade** on top of the native splash. Reviewers who tap-and-wait briefly can perceive "does not load", especially on low-end devices where the WebView is still hydrating.
4. **`android:usesCleartextTraffic="false"`** combined with any transitively-loaded `http://` asset (rare, but possible in dev-only WebView error pages).

Nothing in the frontend appears broken — the web bundle loads fine in the browser and in TestFlight — so the fix has to make the Android shell resilient to those startup hazards without changing app behavior.

### Fixes (Android-only, no user-facing behavior change)

1. **Make Firebase apply conditional on `google-services.json`** in `scripts/android-post-sync.sh`. Only inject the classpath + `apply plugin` when the JSON exists; otherwise strip them back out if previously injected. This guarantees a bundle built without FCM keys will still launch (push simply won't register — a graceful degrade the app already handles).
2. **Harden push init on Android.** In `src/lib/pushNotifications.ts`, wrap the `PushNotifications.register()` path in a defensive try/catch that swallows FCM-init errors and returns `setup_failed` instead of letting the exception surface into the plugin bridge.
3. **Shorten the splash hand-off** in `src/main.tsx` from 2500ms hold + 700ms fade to 600ms hold + 400ms fade. Native splash still hides on first paint; this only affects the HTML overlay above the app.
4. **Add a WebView safety net** in `index.html`: if the module script fails to execute within 8s (e.g. bundle chunk fails), swap in a minimal "Reload" button instead of a blank white screen — this is what Google sees when a chunk 404s post-install.
5. **Version bump** to `66.0.4` via `scripts/bump-android-version.mjs` so the new AAB can be uploaded to Play.
6. **Add a launch smoke test hint** to `scripts/android-post-sync.sh`: after sync, print a checklist reminding the user to verify `google-services.json` is in place and to install the AAB on a clean device before uploading.

### Files touched

- `scripts/android-post-sync.sh` — conditional google-services block + checklist
- `src/lib/pushNotifications.ts` — Android-safe try/catch around FCM register
- `src/main.tsx` — shorter splash overlay timings
- `index.html` — 8s "failed to load" fallback with reload button
- `package.json` / `package-lock.json` / `android/app/build.gradle` (via `bump-android-version.mjs`) — 66.0.3 → 66.0.4

### What is NOT changed

- No RLS / DB / edge function changes.
- No UI, routing, auth, or business logic changes.
- No plugin version bumps (avoids surprise regressions before re-submission).
- `capacitor.config.ts` is untouched — no `server.url`, still HTTPS-only.

### After merge — user steps on their Mac

```
bash scripts/pull-updates.sh          # rebuilds + cap sync android + post-sync
node scripts/bump-android-version.mjs # optional if not already bumped
npx cap open android                  # Build → Generate Signed Bundle → upload
```

Then in Play Console, respond to the policy review with the new AAB (versionCode 660004).