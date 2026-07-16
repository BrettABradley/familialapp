#!/bin/bash
# Post-sync script to inject Android manifest/Gradle settings that Capacitor
# doesn't manage. Idempotent — safe to run after every `npx cap sync android`.
#
# Mirrors scripts/ios-post-sync.sh for the Android platform.
set -e

ANDROID_DIR="android"
MANIFEST="$ANDROID_DIR/app/src/main/AndroidManifest.xml"
APP_GRADLE="$ANDROID_DIR/app/build.gradle"
ROOT_GRADLE="$ANDROID_DIR/build.gradle"
STRINGS="$ANDROID_DIR/app/src/main/res/values/strings.xml"

if [ ! -d "$ANDROID_DIR" ]; then
  echo "ℹ️  No android/ directory — skipping Android post-sync."
  exit 0
fi

echo "▶ Android post-sync starting…"

# --- 1. App display name ----------------------------------------------------
if [ -f "$STRINGS" ]; then
  if grep -q '"app_name"' "$STRINGS"; then
    perl -0pi -e 's|<string name="app_name">[^<]*</string>|<string name="app_name">Familial</string>|g' "$STRINGS"
    perl -0pi -e 's|<string name="title_activity_main">[^<]*</string>|<string name="title_activity_main">Familial</string>|g' "$STRINGS"
  fi
  echo "✅ strings.xml: app name set to Familial"
fi

# --- 2. Permissions in AndroidManifest.xml ---------------------------------
if [ -f "$MANIFEST" ]; then
  add_perm() {
    local NAME="$1"
    if ! grep -q "android.permission.$NAME" "$MANIFEST"; then
      perl -0pi -e "s|<manifest |<manifest |;" "$MANIFEST" # no-op anchor
      perl -0pi -e "s|(<manifest[^>]*>)|\$1\n    <uses-permission android:name=\"android.permission.$NAME\" />|" "$MANIFEST"
      echo "  + permission $NAME"
    fi
  }
  for P in INTERNET POST_NOTIFICATIONS CAMERA RECORD_AUDIO VIBRATE WAKE_LOCK READ_MEDIA_IMAGES READ_MEDIA_VIDEO READ_EXTERNAL_STORAGE; do
    add_perm "$P"
  done
  echo "✅ AndroidManifest.xml: permissions ensured"

  # <queries> block for external app handoff
  if ! grep -q "<queries>" "$MANIFEST"; then
    perl -0pi -e 's|(</manifest>)|    <queries>\n        <intent>\n            <action android:name="android.intent.action.VIEW" />\n            <data android:scheme="https" />\n        </intent>\n        <intent>\n            <action android:name="android.intent.action.VIEW" />\n            <data android:scheme="geo" />\n        </intent>\n        <intent>\n            <action android:name="android.intent.action.SENDTO" />\n            <data android:scheme="mailto" />\n        </intent>\n        <intent>\n            <action android:name="android.intent.action.DIAL" />\n            <data android:scheme="tel" />\n        </intent>\n    </queries>\n$1|s' "$MANIFEST"
    echo "✅ AndroidManifest.xml: <queries> added"
  fi

  # Block cleartext traffic
  if ! grep -q 'android:usesCleartextTraffic="false"' "$MANIFEST"; then
    perl -0pi -e 's|<application |<application android:usesCleartextTraffic="false" |' "$MANIFEST"
    echo "✅ AndroidManifest.xml: cleartext traffic disabled"
  fi

  # Deep-link intent-filter (App Links)
  if ! grep -q 'familialmedia.com' "$MANIFEST"; then
    perl -0pi -e 's|(<activity[^>]*android:name="\.MainActivity"[^>]*>)|$1\n            <intent-filter android:autoVerify="true">\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="https" android:host="familialmedia.com" android:pathPrefix="/auth/callback" />\n                <data android:scheme="https" android:host="www.familialmedia.com" android:pathPrefix="/auth/callback" />\n            </intent-filter>|' "$MANIFEST"
    echo "✅ AndroidManifest.xml: deep-link intent-filter added"
  fi
fi

# --- 3. Google Services Gradle plugin (FCM) --------------------------------
# Only apply the google-services plugin when google-services.json exists,
# otherwise the app crashes on launch with "Default FirebaseApp is not
# initialized". If the JSON was later removed, strip previously-injected
# lines so an FCM-less build still boots cleanly.
GS_JSON="$ANDROID_DIR/app/google-services.json"
if [ -f "$GS_JSON" ]; then
  if [ -f "$ROOT_GRADLE" ] && ! grep -q 'com.google.gms:google-services' "$ROOT_GRADLE"; then
    perl -0pi -e 's|(dependencies\s*\{)|$1\n        classpath "com.google.gms:google-services:4.4.2"|' "$ROOT_GRADLE"
    echo "✅ root build.gradle: google-services classpath added"
  fi
  if [ -f "$APP_GRADLE" ] && ! grep -q "com.google.gms.google-services" "$APP_GRADLE"; then
    echo "" >> "$APP_GRADLE"
    echo "apply plugin: 'com.google.gms.google-services'" >> "$APP_GRADLE"
    echo "✅ app build.gradle: google-services plugin applied"
  fi
else
  # Strip google-services wiring if it was previously injected — an app
  # with the plugin applied but no google-services.json will hard-crash at
  # boot, which is what Play reviewers flag as "Broken Functionality".
  if [ -f "$ROOT_GRADLE" ] && grep -q 'com.google.gms:google-services' "$ROOT_GRADLE"; then
    perl -0pi -e 's|\s*classpath "com.google.gms:google-services:[^"]+"\n?||g' "$ROOT_GRADLE"
    echo "⚠️  root build.gradle: google-services classpath REMOVED (no google-services.json present)"
  fi
  if [ -f "$APP_GRADLE" ] && grep -q "com.google.gms.google-services" "$APP_GRADLE"; then
    perl -0pi -e "s|\napply plugin: 'com.google.gms.google-services'\n?|\n|g" "$APP_GRADLE"
    echo "⚠️  app build.gradle: google-services plugin REMOVED (no google-services.json present)"
  fi
fi

# --- 4. versionCode/versionName from package.json --------------------------
if [ -f "$APP_GRADLE" ] && [ -f "package.json" ]; then
  PKG_VER=$(node -p "require('./package.json').version" 2>/dev/null || echo "1.0.0")
  # versionCode: integer bump = major*10000 + minor*100 + patch
  IFS='.' read -r MA MI PA <<< "$PKG_VER"
  VC=$(( ${MA:-1} * 10000 + ${MI:-0} * 100 + ${PA:-0} ))
  perl -0pi -e "s|versionCode \\d+|versionCode $VC|g" "$APP_GRADLE"
  perl -0pi -e "s|versionName \"[^\"]+\"|versionName \"$PKG_VER\"|g" "$APP_GRADLE"
  echo "✅ app build.gradle: versionCode=$VC, versionName=$PKG_VER"
fi

# --- 5. Reminder for one-time setup steps ----------------------------------
if [ ! -f "$ANDROID_DIR/app/google-services.json" ]; then
  echo ""
  echo "⚠️  android/app/google-services.json is missing."
  echo "   Create a Firebase project, register an Android app with package"
  echo "   com.familialmedia.familial, download google-services.json,"
  echo "   and drop it into android/app/."
fi

# --- 6. Launcher icons (fixes Play Console "default icon" rejection) -------
# Regenerates mipmap-* PNGs + adaptive icon XML from resources/icon.png and
# resources/icon-foreground.png so the installed app matches the Play Store
# brand mark instead of the stock Capacitor placeholder.
if [ -f "resources/icon.png" ] && [ -f "resources/icon-foreground.png" ]; then
  echo "▶ Regenerating Android launcher icons from resources/…"
  npx @capacitor/assets generate \
    --android \
    --iconBackgroundColor '#FFFFFF' \
    --iconBackgroundColorDark '#FFFFFF' \
    --splashBackgroundColor '#FFFFFF' \
    --splashBackgroundColorDark '#FFFFFF' \
    2>&1 | sed 's/^/   /' || echo "⚠️  @capacitor/assets failed — run 'npm i -D @capacitor/assets' and retry."
  echo "✅ Launcher icons regenerated (mipmap-mdpi → xxxhdpi + adaptive)"
else
  echo "⚠️  resources/icon.png or resources/icon-foreground.png missing — launcher icons NOT regenerated."
fi

# --- 7. assetlinks.json fingerprint check (blocks App Links from shipping unverified) ---
if [ -f "scripts/check-assetlinks.mjs" ]; then
  if ! node scripts/check-assetlinks.mjs; then
    echo ""
    echo "❌ Aborting Android post-sync — fix assetlinks.json before rebuilding the AAB."
    exit 1
  fi
fi

echo "▶ Android post-sync done."
echo ""
echo "🧪 Pre-upload checklist:"
echo "   1. Confirm android/app/google-services.json exists (or accept push-less build)."
echo "   2. Install the AAB on a clean device/emulator and verify it opens past splash."
echo "   3. Check adb logcat for FATAL EXCEPTION during launch before shipping to Play."
echo "   4. Send yourself a test verification email and tap it on the review device"
echo "      to confirm /auth/callback opens in the app (not Chrome)."
echo "   5. Make a small test purchase — force-quit the app mid-validation to confirm"
echo "      the pending-receipt queue drains on next launch (no support ticket needed)."


