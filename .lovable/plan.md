## Goal
Align the Android app's package/bundle ID with iOS (`com.familialmedia.familial`) so both platforms share one consistent identifier.

## Changes

### 1. `capacitor.config.ts`
Update the top-level `appId`:
- From: `space.manus.familial.mobile.t20260223211425`
- To: `com.familialmedia.familial`

This is the source of truth Capacitor uses when generating native projects. iOS won't be affected on the App Store (Xcode's `PRODUCT_BUNDLE_IDENTIFIER` is already `com.familialmedia.familial` and overrides this), but future `npx cap add` runs will produce consistent native shells.

### 2. `scripts/android-post-sync.sh`
Update the reminder message that mentions the old placeholder package name, so it tells you to register `com.familialmedia.familial` in Firebase instead.

### 3. Android native folder (`android/`)
The `android/` folder is generated locally on your Mac and is git-ignored — I can't edit it from here. After you pull the changes above, you will need to do this **once** in VS Code:

In `android/app/build.gradle`, inside `defaultConfig { ... }`:
```gradle
applicationId "com.familialmedia.familial"
namespace "com.familialmedia.familial"
```

(Alternative: delete `android/` entirely and run `npx cap add android` again — it will use the new `appId` from `capacitor.config.ts` automatically.)

## What you do after I make these changes

1. `git pull` in VS Code
2. Edit `android/app/build.gradle` (two lines above) — OR `rm -rf android && npx cap add android`
3. In Firebase Console → add a new Android app with package `com.familialmedia.familial`, download the fresh `google-services.json`, replace `android/app/google-services.json`
4. `cd android && ./gradlew clean && cd ..`
5. `npx cap sync android && bash scripts/android-post-sync.sh && npx cap open android`
6. In Google Play Console, use `com.familialmedia.familial` as the package name (this is permanent once first uploaded)

## Notes
- iOS App Store build is unaffected — its bundle ID is locked in the Xcode project, not in `capacitor.config.ts`.
- The old Firebase Android app entry (with the `space.manus...` package) can be deleted after the new one works.