

## Add iOS Dependency for Capacitor

### Current State
- `@capacitor/core`, `@capacitor/cli`, and `@capacitor/android` are already installed
- `capacitor.config.ts` is already configured
- **Missing**: `@capacitor/ios`

### Change
**`package.json`** — Add `@capacitor/ios: "^8.2.0"` to dependencies.

That's the only code change needed. After this, your local steps are:

1. Export to GitHub, git pull locally
2. `npm install`
3. `npx cap add ios` and `npx cap add android`
4. `npm run build && npx cap sync`
5. `npx cap open ios` (opens Xcode) / `npx cap open android` (opens Android Studio)

**Production reminder**: Before submitting to the App Store or Play Store, remove the `server` block from `capacitor.config.ts` so the app uses bundled local files instead of the live preview URL.

