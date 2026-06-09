#!/bin/bash
# Safely pull the latest Lovable changes into the local repo without losing
# untracked native files (android/app/google-services.json, the whole android/
# folder, package-lock.json, edited build.gradle, etc.).
#
# Usage:
#   bash scripts/pull-updates.sh            # Android only (default)
#   bash scripts/pull-updates.sh ios        # iOS only
#   bash scripts/pull-updates.sh both       # iOS + Android
set -e

TARGET="${1:-android}"

echo "▶ 1/6  Stashing local changes (incl. untracked native files)…"
# --include-untracked keeps google-services.json safe. If nothing to stash,
# `git stash pop` later is skipped via the marker.
if git stash push -u -m "pull-updates-autostash" >/dev/null 2>&1; then
  STASHED=1
  echo "   ✅ stashed"
else
  STASHED=0
  echo "   (nothing to stash)"
fi

echo "▶ 2/6  Pulling latest Lovable changes…"
git pull --rebase

if [ "$STASHED" = "1" ]; then
  echo "▶ 3/6  Re-applying your local changes…"
  if ! git stash pop; then
    echo ""
    echo "⚠️  Merge conflict while restoring your local files."
    echo "   Open the conflicted file(s), keep your edits, then run:"
    echo "     git add <file>  &&  git stash drop"
    exit 1
  fi
else
  echo "▶ 3/6  (no stash to restore — skipping)"
fi

echo "▶ 4/6  Installing JS deps…"
npm install --legacy-peer-deps

echo "▶ 5/6  Building web bundle…"
npm run build

case "$TARGET" in
  android)
    echo "▶ 6/6  Syncing Android…"
    npx cap sync android
    bash scripts/android-post-sync.sh
    echo "✅ Done. Run: npx cap open android"
    ;;
  ios)
    echo "▶ 6/6  Syncing iOS…"
    npx cap sync ios
    bash scripts/ios-post-sync.sh
    echo "✅ Done. Run: npx cap open ios"
    ;;
  both)
    echo "▶ 6/6  Syncing iOS + Android…"
    npx cap sync ios
    bash scripts/ios-post-sync.sh
    npx cap sync android
    bash scripts/android-post-sync.sh
    echo "✅ Done. Run: npx cap open ios   /   npx cap open android"
    ;;
  *)
    echo "❌ Unknown target: $TARGET (use: android | ios | both)"
    exit 1
    ;;
esac
