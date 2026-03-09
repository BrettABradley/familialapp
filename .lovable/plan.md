

## Plan: Set up Capacitor for native iOS and Android builds

### What this does
Adds Capacitor to the project so you can build and publish the app as a native iOS and Android app on the App Store and Google Play. The app will use the same backend database — no changes needed there.

### Changes

#### 1. Install Capacitor dependencies
Add to `package.json`:
- `@capacitor/core` (dependency)
- `@capacitor/cli` (dev dependency)
- `@capacitor/ios` (dependency)
- `@capacitor/android` (dependency)

#### 2. Create `capacitor.config.ts`
```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.f745440093af4f4390a60d52ff08c778',
  appName: 'familialapp',
  webDir: 'dist',
  server: {
    url: 'https://f7454400-93af-4f43-90a6-0d52ff08c778.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
```

The `server.url` enables hot-reload from the sandbox during development. Before publishing to app stores, remove the `server` block so the app uses the bundled `dist/` folder.

#### 3. Update `index.html`
Add mobile-optimized meta tags (status bar, theme color, apple mobile web app capable).

### After I make these changes, you will need to:

1. **Export to GitHub** via the "Export to GitHub" button in Lovable
2. **Clone and install** locally:
   ```bash
   git clone <your-repo>
   cd <your-repo>
   npm install
   ```
3. **Add native platforms**:
   ```bash
   npx cap add ios
   npx cap add android
   ```
4. **Build and sync**:
   ```bash
   npm run build
   npx cap sync
   ```
5. **Run on device/emulator**:
   - iOS: `npx cap run ios` (requires Mac with Xcode)
   - Android: `npx cap run android` (requires Android Studio)

6. **Before publishing** to stores, remove the `server` block from `capacitor.config.ts` so the app uses the local bundle instead of the dev server.

For a detailed walkthrough of the full publishing process, check out: https://docs.lovable.dev/tips-tricks/mobile-development

### Files to create/modify
- `capacitor.config.ts` (create)
- `package.json` (add dependencies)
- `index.html` (add mobile meta tags)

