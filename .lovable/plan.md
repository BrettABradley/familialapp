# Swap Android Launcher Icon to Uploaded FG Mark

Replace the AI-generated FG logo with the official one you just uploaded.

## Steps
1. Copy `user-uploads://App_Icon_-_Familial.png` → `resources/icon.png` (1024×1024 master, white background — used for the legacy square launcher icon).
2. Copy the same file → `resources/icon-foreground.png` (the mark already has ~12% padding; Android's adaptive mask trims ~25%, so I'll also generate a padded version to keep the FG fully visible inside the circle/squircle mask).
3. Create `resources/icon-foreground-padded.png` by compositing the uploaded mark at ~70% scale onto a transparent 1024×1024 canvas (Python/PIL) so it survives the adaptive-icon safe zone.
4. No code, script, or version changes — `scripts/android-post-sync.sh` already runs `@capacitor/assets generate --android` and reads from `resources/`.

## What you do after
Run `bash scripts/pull-updates.sh` on your Mac, rebuild the AAB in Android Studio, and resubmit. The launcher will be your uploaded FG mark on a white background.
