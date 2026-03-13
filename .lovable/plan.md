

## Set Up Capacitor for Native Mobile Builds

### What We'll Do
Install and configure Capacitor so you can build native iOS and Android apps from your existing web app.

### Changes

**1. Install Capacitor dependencies**
- `@capacitor/core`, `@capacitor/cli` (dev), `@capacitor/ios`, `@capacitor/android`

**2. Create `capacitor.config.ts`**
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

The `server.url` enables live hot-reload from your Lovable preview directly on your device during development. Remove it before production builds so the app uses the bundled `dist/` files.

### After I Make the Changes — Your Local Steps

1. **Export to GitHub** via the "Export to GitHub" button in Lovable
2. **Git pull** the project to your local machine
3. Run `npm install`
4. Add platforms: `npx cap add ios` and/or `npx cap add android`
5. Run `npx cap update ios` / `npx cap update android`
6. Run `npm run build`
7. Run `npx cap sync`
8. Run `npx cap run ios` (requires Mac + Xcode) or `npx cap run android` (requires Android Studio)

After any future code changes, git pull and run `npx cap sync` to update the native project.

For more details, check out the [Lovable blog post on Capacitor mobile development](https://lovable.dev/blog/mobile-app-with-lovable).

### Files Changed
- `package.json` — add Capacitor dependencies
- `capacitor.config.ts` — new file with app configuration

