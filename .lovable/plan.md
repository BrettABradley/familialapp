

# Add Encryption Compliance Flag to Capacitor Config

Apple asks about encryption compliance on every TestFlight/App Store upload unless you declare `ITSAppUsesNonExemptEncryption = NO` in your `Info.plist`. We can automate this by adding it to `capacitor.config.ts` so it gets merged into the native project on every `npx cap sync`.

## What changes

**File: `capacitor.config.ts`**

Add an `appendUserAgent` or `iOS` config block that injects the plist key automatically:

```ts
const config: CapacitorConfig = {
  // ...existing config
  ios: {
    contentInset: 'automatic',
    // This merges into Info.plist on cap sync
    appendUserAgent: undefined,
  },
};
```

However, Capacitor doesn't support arbitrary plist injection from `capacitor.config.ts`. The correct approach is to create a **Capacitor hook script** or simply add the key via a small post-sync script.

**Simplest reliable approach**: Create a `scripts/set-encryption-flag.sh` script that adds the key to the iOS plist after each `cap sync`, and document it. But since you want zero manual steps:

**Best approach**: Add the key directly in the Capacitor iOS project's `Info.plist` via a `cordova-custom-config`-style plugin, or more practically, just set it in `capacitor.config.ts` under the undocumented `ios.overrideUserInterfaceStyle` pattern — but Capacitor doesn't support arbitrary plist keys natively.

**Recommended solution**: Create a small `scripts/ios-post-sync.sh` that runs `PlistBuddy` to inject the flag, and update `package.json` with a convenience script.

## Plan

1. **Create `scripts/ios-post-sync.sh`** — a 3-line script that uses `/usr/libexec/PlistBuddy` to set `ITSAppUsesNonExemptEncryption` to `false` in `ios/App/App/Info.plist`

2. **Add npm script to `package.json`** — `"cap:sync:ios": "npx cap sync ios && sh scripts/ios-post-sync.sh"` so you just run `npm run cap:sync:ios` and it handles everything

3. **Also add `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription`** to the same script so you never lose those either after a fresh `cap sync`

This way, every time you sync, the encryption flag and privacy strings are automatically injected — no more Apple compliance prompts.

