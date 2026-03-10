

# Splash Screen and App Icon Configuration for Capacitor

## What We Have
- `src/assets/icon.png` — the "F" logomark (black on white, high resolution)
- `src/assets/logo.png` — full logo with "FAMILIAL" text
- Brand colors: black and white theme (`#1a1a2e` theme-color in index.html)

## What We Will Do

### 1. Install `@capacitor/splash-screen` plugin
Add the `@capacitor/splash-screen` package to the project dependencies.

### 2. Update `capacitor.config.ts` with splash screen settings
Add a `plugins.SplashScreen` configuration block:
- Background color: `#FFFFFF` (white, matching brand)
- Auto-hide after app loads (3 seconds max)
- Fade out duration for smooth transition
- Show spinner while loading

### 3. Add app icon and splash screen source assets
Create a `resources/` directory in the project root with:
- `resources/icon.png` — copy of `src/assets/icon.png` (the "F" logomark, used as the app icon)
- `resources/splash.png` — a 2732x2732 centered logo on white background (created from the icon)

These are the source files that Capacitor's asset generation tool (`@capacitor/assets`) uses to produce all required sizes for iOS and Android.

### 4. Add `@capacitor/assets` as a dev dependency
This is the official tool to generate all icon and splash screen variants from single source files. After pulling the project locally, the user runs:
```bash
npx capacitor-assets generate
```
This produces all required iOS/Android icon sizes and splash screen variants automatically.

### 5. Local steps for the user
After the code changes, on their local machine:
1. `git pull` and `npm install`
2. `npx capacitor-assets generate` — generates all native icon/splash assets
3. `npx cap sync` — syncs to native projects
4. `npx cap run android` or `npx cap run ios`

## Files Changed
| File | Change |
|------|--------|
| `capacitor.config.ts` | Add SplashScreen plugin config |
| `resources/icon.png` | Copy of icon asset for Capacitor asset generation |
| `resources/splash.png` | Splash source image (logo centered on white) |
| `package.json` | Add `@capacitor/splash-screen` and `@capacitor/assets` (dev) |

