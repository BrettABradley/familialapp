

# Add iOS Support to Capacitor Setup

## Current State
- `@capacitor/core`, `@capacitor/cli`, and `@capacitor/android` are already installed
- `@capacitor/ios` is **missing**

## Plan

### 1. Add `@capacitor/ios` dependency
Add `@capacitor/ios: ^8.2.0` to `package.json` dependencies.

### 2. Remove hot-reload server URL (production readiness)
The `capacitor.config.ts` currently has a `server.url` pointing to the Lovable preview. This is fine for development but must be removed before App Store / Play Store submission. We will leave it for now since you're still developing, but flag it for later.

## Local Steps (on your machine)
After pulling the updated code:
1. `npm install`
2. `npx cap add ios` (one-time, creates the `ios/` folder)
3. `npx cap add android` (one-time if not done yet, creates the `android/` folder)
4. `npx capacitor-assets generate` (generates all icon/splash sizes)
5. `npx cap sync` (syncs web assets + plugins to both platforms)
6. `npx cap run ios` — requires a Mac with Xcode
7. `npx cap run android` — requires Android Studio

For more details, see the [Lovable native mobile guide](https://docs.lovable.dev/tips-tricks/mobile-development).

## Files Changed
| File | Change |
|------|--------|
| `package.json` | Add `@capacitor/ios` |

