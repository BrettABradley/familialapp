#!/bin/bash
# Post-sync script to inject Info.plist keys that Capacitor doesn't manage

PLIST="ios/App/App/Info.plist"

if [ ! -f "$PLIST" ]; then
  echo "⚠️  $PLIST not found — skipping post-sync plist injection"
  exit 0
fi

PB=/usr/libexec/PlistBuddy

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

# NOTE: The "Push Notifications" capability + aps-environment entitlement must be
# enabled ONCE in Xcode: open ios/App/App.xcworkspace → Signing & Capabilities →
# "+ Capability" → Push Notifications. This writes App.entitlements and cannot be
# done from Info.plist alone.

echo "✅ Info.plist updated: encryption compliance + privacy strings + push background mode"
echo ""
echo "ℹ️  Push notifications are sent directly to Apple APNs (no third party)."
echo "   Required Lovable Cloud secrets: APPLE_KEY_ID, APPLE_ISSUER_ID (Team ID), APPLE_PRIVATE_KEY (.p8)."
echo "   Optional: APNS_ENV=sandbox for local Xcode dev builds (default: production)."
echo ""
echo "⚠️  MANUAL XCODE STEPS REQUIRED (one-time, after every fresh 'cap add ios'):"
echo "   1. Open ios/App/App.xcworkspace in Xcode"
echo "   2. Select 'App' target → Signing & Capabilities"
echo "   3. Click '+ Capability' → add 'Push Notifications'"
echo "      (This generates App.entitlements with the aps-environment key.)"
echo "      Without this, PushNotifications.register() throws at launch and"
echo "      can crash App Review's automated test."
echo "   4. Confirm Deployment Target ≥ iOS 14.0"
echo "   5. Product → Clean Build Folder before Archive"
