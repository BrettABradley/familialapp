# iOS Launch Stability Hardening

Apple's "crashed after initial launch" rejection means the binary terminated before the WebView could show the UI. Without the symbolicated crash log we can't be 100% sure which native call faulted, but the launch path has several places where one failing plugin can take the whole app down. This plan removes those failure modes and adds a Splash Screen so we never show a white screen during init.

## Most likely culprits (in priority order)

1. **`initCapacitorPlugins()` runs at module load** (`src/main.tsx`) and isn't awaited. The `StatusBar` / `Keyboard` dynamic imports + setters fire before React mounts. If either plugin throws (missing pod after a sync, entitlement mismatch, iPad-specific edge case), the unhandled rejection on iOS 17+ WKWebView can hard-kill the process.
2. **Push Notifications plugin** is in `package.json` and `UIBackgroundModes:remote-notification` is set in Info.plist, but the `aps-environment` entitlement must be added in Xcode. If the provisioning profile doesn't include push, `PushNotifications.register()` will throw at launch (we call it from `onAuthStateChange` immediately on cold start with a cached session).
3. **No Splash Screen plugin installed.** iOS shows the launch storyboard, then a blank WebView until React mounts. If the WebView fails to load `index.html` for any reason (bad asset path, missing `dist/` after sync), Apple's automated test sees a frozen/blank app and logs it as a crash.
4. **`@capgo/native-purchases`** — lazy-loaded, so won't crash launch unless something imports it eagerly. Confirmed lazy in `iapPurchase.ts` ✓.
5. **Encryption flag** is already set via `ios-post-sync.sh` ✓.

## Changes

### 1. Make `initCapacitorPlugins` crash-proof
File: `src/lib/capacitorInit.ts`
- Wrap the whole function body in try/catch and **each plugin import + call in its own try/catch** so a single missing/failed plugin can't abort the rest.
- Move `await` chain off the top-level promise: log errors with `console.error` instead of rethrowing.
- Move push-registration listeners behind a `try/catch` and only call `PushNotifications.register()` if `aps-environment` is likely present (we'll just swallow registration errors — they're non-fatal).

### 2. Defer non-essential native init until after first paint
File: `src/main.tsx`
- Call `initCapacitorPlugins()` from inside a `requestIdleCallback` / `setTimeout(…, 0)` after `createRoot(...).render(...)` so the WebView paints the React tree first. Even if a plugin throws, the UI is already up.

### 3. Add Splash Screen plugin
- Install `@capacitor/splash-screen`.
- Configure in `capacitor.config.ts`:
  ```ts
  SplashScreen: {
    launchShowDuration: 2000,
    launchAutoHide: true,
    backgroundColor: '#ffffff',
    showSpinner: false,
  }
  ```
- Call `SplashScreen.hide()` after React mounts (in `App.tsx` `useEffect`).
- This prevents the "blank white screen" Apple's automated reviewer interprets as a crash.

### 4. Stricter ErrorBoundary at root for native
File: `src/components/shared/ErrorBoundary.tsx`
- On native, also log to `console.error` with structured info (we can see in Xcode).
- Add a "Reload App" button that, on native, calls `window.location.reload()` (already does).

### 5. Verify Info.plist + entitlement requirements in `ios-post-sync.sh`
File: `scripts/ios-post-sync.sh`
- Add a final `echo` block reminding the user to verify in Xcode:
  - Signing & Capabilities → **Push Notifications** is added (creates `App.entitlements` with `aps-environment`).
  - Deployment target ≥ iOS 14.
  - "Build Phases → Copy Bundle Resources" includes the `public/` web assets via `dist/`.

### 6. Add a launch breadcrumb
File: `src/main.tsx`
- Log `[boot] react-mount-start` before `createRoot(...).render()` and `[boot] react-mount-end` in an effect inside `<App>`. Combined with Xcode console capture, this tells us whether the crash is **before** React mounts (native crash) or **after** (JS/runtime error).

## What this does NOT change

- No business-logic or routing changes.
- No feature removal.
- No edge function or DB changes.

## After the fix
You'll need to:
```
git pull
npm install --legacy-peer-deps
npm run build
npm run cap:sync:ios
```
Then in Xcode: open `ios/App/App.xcworkspace`, Signing & Capabilities → confirm **Push Notifications** capability is checked. Archive and upload a new build.

## One question to confirm scope
If you have the Apple crash report (Xcode → Window → Organizer → Crashes, or the `.crash` file Apple attached to the rejection email), paste the top of the stack trace. That will let me pinpoint the exact failing call instead of hardening defensively. If you don't have it, the changes above are the safest broad-spectrum fix.
