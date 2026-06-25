# Fix Android Launcher Icon Rejection

## What Google flagged
The Play Console screenshot shows two different icons for your app:
- **App icon (Store listing)** — the black "FG" Familial mark ✅
- **Launcher icon (installed app)** — the default blue Capacitor "X" on a white square ❌

Google rejects this because the icon installed on the user's phone doesn't match the brand icon shown on the Play Store. Right now, your Android build ships the stock Capacitor placeholder because we never replaced the files in `android/app/src/main/res/mipmap-*/`.

## Root cause
The `android/` folder is generated locally by `npx cap add android` and is not committed to this repo. When Capacitor scaffolds it, it drops in default `ic_launcher.png` / `ic_launcher_round.png` / `ic_launcher_foreground.png` placeholders across five density buckets (mdpi → xxxhdpi). Nothing in `scripts/android-post-sync.sh` overwrites them, so every `cap sync` keeps the placeholder.

## Plan

1. **Add a branded master icon** at `resources/icon.png` (1024×1024, the black "FG" mark on a warm cream background so it reads on both dark and light home screens — matching your Play Store listing).
2. **Add an adaptive-icon foreground** at `resources/icon-foreground.png` (1024×1024, transparent background, FG mark centered with ~25% safe-area padding so Android's mask doesn't clip it).
3. **Install `@capacitor/assets`** as a dev dependency. This is the official Capacitor tool that generates every required density (mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi) plus adaptive icon XML in one command.
4. **Extend `scripts/android-post-sync.sh`** to:
   - Run `npx @capacitor/assets generate --android` after `cap sync`.
   - Write `android/app/src/main/res/values/ic_launcher_background.xml` with the brand background color so adaptive icons render correctly on Android 8+.
5. **Update `scripts/pull-updates.sh`** flow notes so the regeneration happens automatically on every build.
6. **Bump `versionCode`/`versionName`** via the existing `bump-android-version.mjs` so you can upload a fresh AAB to Play Console.

## Technical details

- `@capacitor/assets generate --android` reads `resources/icon.png` (legacy square icon) and `resources/icon-foreground.png` + a background color/image to produce:
  - `mipmap-*/ic_launcher.png`
  - `mipmap-*/ic_launcher_round.png`
  - `mipmap-anydpi-v26/ic_launcher.xml` (adaptive)
  - `mipmap-anydpi-v26/ic_launcher_round.xml`
  - `mipmap-*/ic_launcher_foreground.png`
- We'll add the resource files to the **post-sync script** rather than committing the generated PNGs, because `android/` itself isn't in the repo on your local machine until you run `npx cap add android`.

## What you'll do after I ship this
1. `bash scripts/pull-updates.sh` (pulls + installs + builds + cap sync — the post-sync step regenerates the icons).
2. Open Android Studio → Build → Generate Signed App Bundle.
3. Upload the new AAB to Play Console and resubmit. The launcher icon will now be the Familial FG mark.

## One question before I build
The Play Store icon is the **black FG mark on transparent/white**. Do you want the launcher icon to be:
- **(A)** Black FG mark on a **cream/warm off-white** square (matches your in-app brand palette, looks premium on both light and dark home screens), **OR**
- **(B)** White FG mark on a **solid black** square (max contrast, more "app-like"), **OR**
- **(C)** Black FG mark on **pure white** (exact match to the Play Store listing tile)?

I'll generate the master icon accordingly and wire up the pipeline.
