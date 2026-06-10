# TestFlight Splash Fix

## What's actually happening on TestFlight

From the screen recording: the splash is a **small white card with the logo on a gray background**, then it cuts straight to the auth page with no slow fade. Two separate issues:

1. **Native iOS LaunchScreen is gray, not white.** The default Capacitor `LaunchScreen.storyboard` uses `systemBackground`, which renders **gray/black in dark mode**. Your test device is in dark mode, so iOS paints the launch screen gray with only the splash image asset (a white square containing the logo) sitting in the middle.
2. **The HTML fade overlay (full white + centered logo, 2.5s hold, 700ms fade) is not visible.** This is either because (a) the IPA was archived before the new web code was synced into `ios/App/App/public/`, or (b) it's there but the gray native splash makes the transition look jarring regardless.

Fix both at once so TestFlight matches what you saw in the emulator.

## Changes

### 1. `scripts/ios-post-sync.sh` — force white launch background

Append two blocks at the end:

- **Force the app into Light appearance during launch** by adding `UIUserInterfaceStyle = Light` to `Info.plist`. This guarantees the LaunchScreen storyboard's `systemBackground` resolves to **white** regardless of the user's iOS dark-mode setting (the WebView itself is already white).
- **Patch `ios/App/App/Base.lproj/LaunchScreen.storyboard`** to explicitly set the root view's `backgroundColor` to white (`red=1 green=1 blue=1 alpha=1`) instead of `systemBackground`. Use a small `perl -0pi -e` substitution that replaces the existing `<color key="backgroundColor" systemColor="systemBackgroundColor" .../>` line with a hard white color tag. Idempotent — safe to re-run.

This guarantees the screen iOS shows before our WebView paints is the **same pure white** as the HTML overlay, so the handoff is seamless.

### 2. Verify the HTML overlay actually ships

No code change needed — the overlay code in `index.html` and `src/main.tsx` is already correct. But for TestFlight to include it, the Mac-side build/archive sequence must be:

```text
bash scripts/pull-updates.sh        # rebuilds dist/ + cap sync copies into ios/App/App/public/
# Xcode:
#   1. Select the "App" target → General → bump Build number (e.g. 47 → 48)
#   2. Product → Clean Build Folder (Shift+Cmd+K)
#   3. Product → Archive → Distribute App → TestFlight
#   4. Wait for "Processing" to finish in App Store Connect
#   5. DELETE the existing app from your device, then reinstall from TestFlight
```

If you skip the Clean Build Folder step or don't bump the Build number, Xcode often re-uses the previous `public/` snapshot baked into derived data.

## How to verify the fix on TestFlight

After installing the new build with a deleted-then-reinstalled app:

1. Cold-launch: you should see a **full white screen edge-to-edge** (no gray border) for ~2.5 s with the logo centered.
2. Then a slow **700 ms fade** into the auth page (not a hard cut).
3. If you still see gray edges, the LaunchScreen storyboard patch didn't apply — re-run `bash scripts/pull-updates.sh` and check the script's output for the storyboard patch log line.

## Files touched

- `scripts/ios-post-sync.sh` — add `UIUserInterfaceStyle=Light` plist key + storyboard background patch
- No changes to `index.html`, `src/main.tsx`, `capacitor.config.ts` (already correct)
