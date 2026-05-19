#!/bin/bash
# Post-sync script to inject Info.plist keys that Capacitor doesn't manage

PLIST="ios/App/App/Info.plist"

if [ ! -f "$PLIST" ]; then
  echo "⚠️  $PLIST not found — skipping post-sync plist injection"
  exit 0
fi

PB=/usr/libexec/PlistBuddy

# Force the iOS home-screen display name to "Familial" (not "familialapp").
# CFBundleDisplayName overrides CFBundleName on the home screen + app switcher.
$PB -c "Delete :CFBundleDisplayName" "$PLIST" 2>/dev/null
$PB -c "Add :CFBundleDisplayName string Familial" "$PLIST"
$PB -c "Set :CFBundleName Familial" "$PLIST" 2>/dev/null || $PB -c "Add :CFBundleName string Familial" "$PLIST"

# Encryption compliance (skips the App Store Connect prompt)
$PB -c "Delete :ITSAppUsesNonExemptEncryption" "$PLIST" 2>/dev/null
$PB -c "Add :ITSAppUsesNonExemptEncryption bool false" "$PLIST"

# Camera permission
$PB -c "Delete :NSCameraUsageDescription" "$PLIST" 2>/dev/null
$PB -c "Add :NSCameraUsageDescription string 'Familial needs access to your camera to take profile pictures and share photos with your family circle.'" "$PLIST"

# Photo library permission
$PB -c "Delete :NSPhotoLibraryUsageDescription" "$PLIST" 2>/dev/null
$PB -c "Add :NSPhotoLibraryUsageDescription string 'Familial needs access to your photo library to upload profile pictures and share photos with your family circle.'" "$PLIST"

# Photo library add permission (saving photos)
$PB -c "Delete :NSPhotoLibraryAddUsageDescription" "$PLIST" 2>/dev/null
$PB -c "Add :NSPhotoLibraryAddUsageDescription string 'Familial needs permission to save photos to your library.'" "$PLIST"

# Microphone permission (required for video recording + voice notes)
# Without this key, iOS hard-crashes the app when the system camera is launched in video mode
# or when getUserMedia requests audio. Required for "Take Photo or Video → Video".
$PB -c "Delete :NSMicrophoneUsageDescription" "$PLIST" 2>/dev/null
$PB -c "Add :NSMicrophoneUsageDescription string 'Familial needs access to your microphone to record video with sound and voice notes for your family circle.'" "$PLIST"

# Background mode: remote-notification (required for push notifications)
$PB -c "Delete :UIBackgroundModes" "$PLIST" 2>/dev/null
$PB -c "Add :UIBackgroundModes array" "$PLIST"
$PB -c "Add :UIBackgroundModes:0 string remote-notification" "$PLIST"

# Push entitlement: make this script self-healing so a fresh native checkout is
# not dependent on remembering the Xcode capability click. Xcode can still show
# the capability in Signing & Capabilities, but the signed app now has a real
# aps-environment entitlement as long as this script has run.
ENTITLEMENTS="ios/App/App/App.entitlements"
PROJECT_FILE="ios/App/App.xcodeproj/project.pbxproj"
if [ -d "ios/App/App" ]; then
  cat > "$ENTITLEMENTS" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>aps-environment</key>
  <string>development</string>
</dict>
</plist>
PLIST
  echo "✅ App.entitlements updated: aps-environment enabled for APNs registration"
fi

if [ -f "$PROJECT_FILE" ] && ! grep -q "CODE_SIGN_ENTITLEMENTS = App/App.entitlements" "$PROJECT_FILE"; then
  perl -0pi -e 's/(PRODUCT_BUNDLE_IDENTIFIER = [^;]+;)/$1\n\t\t\t\tCODE_SIGN_ENTITLEMENTS = App\/App.entitlements;/g' "$PROJECT_FILE"
  echo "✅ Xcode project updated: App.entitlements attached to signing settings"
elif [ -f "$PROJECT_FILE" ]; then
  echo "✅ Xcode project already references App.entitlements"
fi


# Capacitor iOS push bridge. iOS can show the permission prompt and still never
# deliver an APNs token to JavaScript unless AppDelegate forwards native
# registration callbacks to the Capacitor PushNotifications plugin.
APP_DELEGATE="ios/App/App/AppDelegate.swift"
if [ -f "$APP_DELEGATE" ]; then
  if ! grep -q "capacitorDidRegisterForRemoteNotifications" "$APP_DELEGATE"; then
    perl -0pi -e 's/\n}\s*$/\n\n    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {\n        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)\n    }\n\n    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {\n        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)\n    }\n}\n/s' "$APP_DELEGATE"
    echo "✅ AppDelegate updated: Capacitor push registration bridge added"
  else
    echo "✅ AppDelegate already has Capacitor push registration bridge"
  fi
else
  echo "⚠️  $APP_DELEGATE not found — skipping push bridge injection"
fi

echo "✅ Info.plist updated: encryption compliance + privacy strings + push background mode"
echo ""
echo "ℹ️  Push notifications are sent directly to Apple APNs (no third party)."
echo "   Required Lovable Cloud secrets: APPLE_KEY_ID, APPLE_ISSUER_ID (Team ID), APPLE_PRIVATE_KEY (.p8)."
echo "   Optional: APNS_ENV=sandbox for local Xcode dev builds (default: production)."
echo ""
echo "⚠️  XCODE CHECKS BEFORE ARCHIVE:"
echo "   1. Open ios/App/App.xcworkspace in Xcode"
echo "   2. Confirm App target → Signing & Capabilities shows Push Notifications"
echo "   3. Confirm App target → Signing & Capabilities → Background Modes has Remote notifications"
echo "   4. Confirm Deployment Target ≥ iOS 14.0"
echo "   5. Product → Clean Build Folder before Archive"
