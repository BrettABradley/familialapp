# Android code review — what I found

I went through every part of the app that touches the phone's native features and checked it against standard Android practice. Good news first: the add-on versions all match the framework the app uses (the mismatched purchase add-on that caused the crash is gone), every native call is wrapped so a failing feature can't take the app down, the app loads its own bundled files (not a remote dev server), and notification/photo permissions are requested the right way.

Three real problems, one of which will block your next build outright.

## 1. The phone's Back button does nothing useful (high)

There is no Back button handling anywhere in the app. On Android, when an app doesn't handle Back, pressing it closes the app. Because the app moves between screens internally, Android doesn't see those as steps it can go back through — so from a photo album, a chat, or settings, Back quits to the home screen instead of returning to the previous screen.

This is one of the most common reasons Google flags an app for broken navigation, and it's a bad experience regardless.

Fix: add proper Back handling — go back one screen when there is one, and on the main screens send the app to the background (standard Android behavior) rather than closing it. Also make Back close an open photo viewer, dialog, or keyboard first.

## 2. Your app-link file still has placeholder values (high — blocks the build)

`public/.well-known/assetlinks.json` still contains the two `REPLACE_WITH_...` placeholders instead of your real Play signing fingerprints. The safety check in the build script will refuse to finish an Android sync while those placeholders are there, so your next Android build stops with an error. Even if it didn't, email verification links would open in Chrome instead of your app.

Fix: paste the two SHA-256 values from Play Console (App integrity → App signing: "App signing key certificate" and "Upload key certificate") and I'll put them in.

## 3. "Open in Maps / open link" takes a dead path on Android (medium)

The helper that opens external links first tries a method that simply doesn't exist on Android, fails silently, then falls back. It works, but it's wasted work and makes Google Maps / phone / email handoff less reliable than it should be.

Fix: skip the non-existent step on Android and go straight to the working path (map intent, then in-app browser).

## Smaller notes (no change proposed unless you want them)

- The build script injects the deep-link settings by matching the main screen's class name; if that name ever changes the injection quietly does nothing. Adding a "did this actually apply?" check would make a future failure visible.
- Remote debugging of the app's screen is off, which is right for release but means you can't inspect a running release build from Chrome.
- The Android project folder isn't in this repo (it's generated on your machine), so I verified the manifest and permission settings from the script that writes them rather than the final files.

## Technical detail

- Add an `App.addListener('backButton', ...)` handler in a React-Router-aware place (e.g. a small `useAndroidBackButton` hook mounted in `AppLayout`/`App.tsx`), guarded with `Capacitor.getPlatform() === 'android'`: close topmost overlay → `navigate(-1)` when `window.history.length > 1` and not on a root route → otherwise `App.minimizeApp()`. Register through `capacitorInit`-style try/catch and remove the listener on unmount.
- Root routes for minimize: `/`, `/circles`, `/feed`, `/auth`.
- Fill `public/.well-known/assetlinks.json` `sha256_cert_fingerprints` with the two real values; `scripts/check-assetlinks.mjs` currently exits 1 on `REPLACE_WITH_`, aborting `scripts/android-post-sync.sh`.
- In `src/lib/externalUrl.ts`, branch on `Capacitor.getPlatform()`: on Android skip the `App.openUrl` / `App.canOpenUrl` `@ts-expect-error` attempts (not implemented by `@capacitor/app@8`; they belong to `@capacitor/app-launcher`, not installed) and use `geo:`/`Browser.open` directly. Keep iOS behavior unchanged.
- Optional: have `scripts/android-post-sync.sh` verify the intent-filter substitution applied and exit non-zero if not.
- Verify with `bunx tsgo --noEmit -p tsconfig.app.json`; bump with `node scripts/bump-android-version.mjs --sync` before the next AAB.

Nothing here touches iOS behavior.
