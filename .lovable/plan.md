## Goal

- Smooth, full-screen white splash with the Familial logo centered.
- Holds for ~2.5 seconds, then slowly fades out (~700ms) to the app.
- No black flash on the iOS / Android handoff.

You do **not** need to touch Xcode for any of this. Everything below is configured in code that `npx cap sync` pushes into the native projects.

## Approach

The native iOS/Android splash assets only run for the brief moment before the WebView is ready. To get the exact "full white + centered logo, 2.5s hold, slow fade" we used to have, we render an HTML/CSS splash overlay inside `index.html` that:

1. Paints with the first WebView frame (so it's already visible when the native splash hides — no black flash).
2. Looks identical to the native splash (full white, centered logo).
3. Holds for 2.5s after React mounts, then fades out over 700ms.

This makes the chain feel like one continuous splash: native splash → identical HTML splash → fade → app.

## Changes

### 1. `index.html` — full-screen HTML splash overlay

- Add a `<div id="splash">` directly inside `<body>` (before `<div id="root">`).
- Inline CSS in the existing `<style>` block:
  - `#splash`: `position: fixed; inset: 0; background: #ffffff; display: flex; align-items: center; justify-content: center; z-index: 2147483647;` — guarantees a full-screen white layer with the logo perfectly centered.
  - `.splash-logo`: ~140×140 px, `object-fit: contain`, no animation.
  - `#splash.splash-hide`: `opacity: 0; transition: opacity 700ms ease; pointer-events: none;` — slow, smooth fade-out.
- Inline `<script>` safety: if React never mounts within 5s, force `.splash-hide` so users never see a frozen white screen.
- Reference logo as `/splash-logo.png`.

### 2. `public/splash-logo.png` — new

- Copy `src/assets/logo.png` to `public/splash-logo.png` so it's served as a flat static file (no bundler hashing, instantly available on first paint).

### 3. `src/main.tsx` — orchestrate the 2.5s hold + slow fade

After React's first commit + double-rAF:
1. Hide the native splash (overlay is already painted underneath it, so this is invisible to the user).
2. Wait **2500 ms** so the HTML splash holds for ~2.5 seconds total.
3. Add `splash-hide` class → 700 ms CSS fade.
4. After the fade (`+750 ms`), remove the `#splash` element from the DOM.

### 4. `src/lib/capacitorInit.ts` — match native fade to overlay fade

- Bump `SplashScreen.hide({ fadeOutDuration: 150 })` to `400` so the native splash also fades softly when it hands off to the overlay (even though the overlay covers any abrupt cut, this avoids a visible "step" on slower devices).

### 5. `capacitor.config.ts` — keep current settings

- `launchAutoHide: false`, `backgroundColor: '#ffffff'`, `ios.backgroundColor: '#ffffff'`, `android.backgroundColor: '#ffffff'` all stay.
- `launchShowDuration: 3000` stays (safety cap — overlay handles real timing now).

## Why this is better than tweaking Xcode

- Splash *duration* and *fade* live in the Capacitor config + our JS timer, not Xcode — Xcode only owns the static `LaunchScreen.storyboard` image (which displays for milliseconds before the WebView takes over).
- A "full white + centered logo" launch image in Xcode would still get replaced by the WebView's first frame the moment that frame is ready, so the visible 2.5-second splash *must* be HTML-driven. The overlay approach gives us pixel-perfect control on both iOS and Android with one source of truth.

## Files touched

```
index.html                       (HTML splash overlay + safety timer)
public/splash-logo.png           (copy of src/assets/logo.png)
src/main.tsx                     (2.5s hold + 700ms fade orchestration)
src/lib/capacitorInit.ts         (fadeOutDuration 150 → 400)
```

## After implementation

1. `bash scripts/pull-updates.sh`
2. `npx cap open ios` / `npx cap open android`
3. Cold-launch the app: full-white splash with centered logo holds for ~2.5 seconds, then slowly fades into the app — no black flash, no small-square logo, no Xcode changes required.
