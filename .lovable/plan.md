# Fix splash screen black flash

## What's happening

The quick black flash between splash and the app is a classic Capacitor race: the splash is hiding before the WebView has actually painted its first frame, so the WebView's default (black on iOS, system on Android) shows for ~1 frame before React renders the white `--background`.

Two things in the current setup make it worse:

1. `capacitor.config.ts` has BOTH `launchAutoHide: true` AND a manual `SplashScreen.hide()` after 300ms in `capacitorInit.ts`. The auto-hide fires first (often before React mounts), then the manual call runs against an already-hidden splash. Whichever wins, the hide is not tied to "React has painted."
2. The WebView background isn't pinned to white. On iOS the WKWebView defaults to a transparent/black backing, and with `StatusBar.overlaysWebView: true` + `contentInset: 'never'` there's no system chrome covering it during the swap.

## Fix

### 1. `capacitor.config.ts`
- Set `launchAutoHide: false` so the OS never hides the splash on its own.
- Add `backgroundColor: '#ffffff'` at the iOS and Android level (not just the SplashScreen plugin) so the WebView's own backing is white during the handoff.
- Keep `launchShowDuration` short (e.g. 3000) as a safety cap only.

### 2. `src/lib/capacitorInit.ts`
- Remove the `setTimeout(300, hide)` call.
- Export a `hideSplashScreen()` helper that hides once.

### 3. `src/main.tsx`
- After `createRoot(...).render(...)`, wait for the first paint with a double `requestAnimationFrame` and only then call `hideSplashScreen()`. This guarantees React has committed and the browser has painted a white frame before the splash goes away — no black gap.

### 4. (Defensive) `index.html` + `src/index.css`
- Ensure `html, body { background: #ffffff }` is set inline in `index.html`'s `<style>` so even before CSS loads the page is white, not the default transparent/black.

## Why this kills the flash

The black frame only exists in the window between "splash gone" and "React painted." By holding the splash until after React's first committed paint AND making every layer underneath (WebView backing, html/body, splash plugin) explicitly white, there is no moment where anything other than white is on screen.

## Scope

Server-side / web-bundle only. No native rebuild required for iOS — the published web bundle controls the splash-hide timing. For the `capacitor.config.ts` changes (background color, autoHide) to take effect natively, the next `npx cap sync` + rebuild will pick them up on both iOS and Android, but the JS-side "wait for paint before hiding" fix alone already eliminates the flash on existing installs.

## Files touched

- `capacitor.config.ts`
- `src/lib/capacitorInit.ts`
- `src/main.tsx`
- `index.html` (tiny inline style)
