## Goal
Give you a single reusable command sequence to safely pull Lovable changes into VS Code without losing your local Android files (`google-services.json`, edited `build.gradle`, the whole `android/` folder, `package-lock.json`, etc.).

## The standard "pull updates" workflow

Run this **every time** I tell you there are new changes from Lovable:

```bash
# 1. Save any local changes (Android native files, lockfile, etc.)
git stash push -u -m "local-native-files"

# 2. Pull the latest Lovable changes cleanly
git pull --rebase

# 3. Re-apply your local changes on top
git stash pop

# 4. Re-install deps in case package.json changed
npm install --legacy-peer-deps

# 5. Sync web build into native projects
npm run build
npx cap sync android
bash scripts/android-post-sync.sh

# 6. Open Android Studio
npx cap open android
```

If `git stash pop` reports a conflict on a file you've edited (rare — usually only `android/app/build.gradle` if I changed something in it), open the file, keep your edits, and run `git add <file>` + `git stash drop`.

## When iOS is also affected
Add these between steps 5 and 6:
```bash
npx cap sync ios
bash scripts/ios-post-sync.sh
npx cap open ios
```

## Why this is safe
- `git stash -u` includes **untracked** files, so `android/app/google-services.json` (which isn't in git) is preserved.
- `--rebase` keeps your history linear and avoids the "ours vs theirs" merge-commit confusion you hit earlier.
- `--legacy-peer-deps` is required by your project's Capacitor plugin set (per memory).

## What I'll do going forward
Every time I make a change that touches Capacitor config, native scripts, push notifications, IAP, or anything else that needs a rebuild, I'll end my reply with:

> **To pull this update**, run the standard sequence above (or I'll paste the exact subset if only one step is needed).

Want me to save this as a `scripts/pull-updates.sh` one-liner you can just run as `bash scripts/pull-updates.sh`?