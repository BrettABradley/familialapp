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

echo "✅ Info.plist updated: encryption compliance + privacy strings"
