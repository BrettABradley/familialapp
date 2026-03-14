

## Fix: iOS App Loading Lovable Login Instead of Your App

The issue is that `capacitor.config.ts` has a `server.url` pointing to the Lovable preview URL, which requires Lovable editor authentication — that's why you see the Lovable login page instead of your Familial app.

### Plan

**1. Update `capacitor.config.ts`** — Remove the `server` block entirely so the app loads from bundled local files:

```typescript
const config: CapacitorConfig = {
  appId: 'app.lovable.f745440093af4f4390a60d52ff08c778',
  appName: 'familialapp',
  webDir: 'dist',
};
```

**2. After the change**, you'll need to run these commands in your local terminal:

```bash
git pull
npm run build
npx cap sync
npx cap open ios
```

Then hit Play ▶ in Xcode — you should see your actual Familial landing page instead of the Lovable login.

> **Note**: With this approach, after making changes in Lovable you'll need to `git pull && npm run build && npx cap sync` to see updates in the simulator. This is more reliable than the live URL approach which caused the redirect issue.

