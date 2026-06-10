# Plan: Album lock + respect system dark mode in splash/status bar

## 1. Circle switcher locked inside an album

Good news — this is **already implemented in the codebase**:

- `src/pages/Albums.tsx` (lines 328–334) calls `setLockCircleSwitcher(true)` whenever `selectedAlbum` is set and resets it on unmount.
- `src/contexts/CircleContext.tsx` exposes `lockCircleSwitcher`.
- `src/components/layout/AppLayout.tsx` passes it as `lockCircle` to `CircleHeader`.
- `src/components/layout/CircleHeader.tsx` (line 249) renders the circle name as plain text (no `<Select>`) when `lockCircle` is true.

So the lock works on all platforms (web / iOS / Android) — it's just code. The reason it may look unfixed in TestFlight is the same caching issue as the splash screen: the old JS bundle is still inside the `.ipa`. Once you `bash scripts/pull-updates.sh` + Clean Build Folder + bump build number + re-archive, the lock will be live.

**No code change required for this item.** I'll only verify by re-reading the three files above and confirm no regression.

## 2. Stop forcing light mode

Today the app pins itself to a white look regardless of the user's system appearance. This shows up in three places:

| Where | Current value | Problem |
|---|---|---|
| `index.html` `<meta name="theme-color">` | `#ffffff` | Browsers/iOS tint UI chrome white even in dark mode |
| `index.html` inline `<style>` | `html, body { background-color: #ffffff }` | Web body and splash overlay are always white |
| `#splash` overlay background | `#ffffff` | Splash flashes white on a dark-mode device |
| `src/lib/capacitorInit.ts` | `StatusBar.setStyle({ style: Style.Light })` (always) + `apple-mobile-web-app-status-bar-style content="default"` | Status bar icons are wrong color in dark mode |

### Changes

**A. `index.html`**
- Replace the single `theme-color` meta with two media-scoped tags:
  ```html
  <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
  ```
- Add `<meta name="color-scheme" content="light dark" />` so the UA knows the page supports both.
- Update inline CSS so html/body and the `#splash` overlay use the system-appropriate background:
  ```css
  html, body { background-color: #ffffff; margin: 0; }
  #splash { background: #ffffff; ... }
  @media (prefers-color-scheme: dark) {
    html, body { background-color: #0a0a0a; }
    #splash { background: #0a0a0a; }
  }
  ```
- Change `apple-mobile-web-app-status-bar-style` from `default` to `black-translucent` so iOS lets the WebView own status-bar contrast (matches the existing `StatusBar.setOverlaysWebView({ overlay: true })` call).

**B. `src/lib/capacitorInit.ts`**
Replace the unconditional `Style.Light` call with a runtime decision based on `window.matchMedia('(prefers-color-scheme: dark)')`:
- Dark system → `Style.Light` (light icons on dark bg)
- Light system → `Style.Dark` (dark icons on light bg)

Also add a listener so the status-bar style updates live when the user toggles appearance in Settings.

**C. `src/lib/capacitorInit.ts` — splash logo**
The existing splash overlay shows `splash-logo.png`. The logo PNG has a transparent background so it works on either color. No new asset needed.

### Out of scope
- I'm **not** introducing an in-app dark theme toggle or adding `.dark` class wiring on `<html>`. The existing `.dark` token set in `src/index.css` stays untouched. This change only fixes the chrome (splash, status bar, body background pre-React) so it matches the device's system appearance instead of always being white. Adding a full dark UI for the React app itself would be a separate, much larger task — say the word and we can scope it next.

## Files changed
- `index.html` — theme-color + color-scheme metas, inline CSS for dark fallback, status-bar meta value
- `src/lib/capacitorInit.ts` — dynamic `StatusBar.setStyle` based on `prefers-color-scheme` + change listener

## Deployment reminder
This (and the album lock) will only show up in TestFlight after: `bash scripts/pull-updates.sh` → bump Build number in Xcode → Product › Clean Build Folder → Archive → upload → delete old TestFlight app on phone before installing.
