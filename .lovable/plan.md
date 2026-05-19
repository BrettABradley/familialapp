## Goal

Whenever you ship a new TestFlight/App Store build, users see a dismissible "Update available" prompt on next login — with **zero manual work** on your end (no DB row to update, no admin toggle to flip).

## How it works

Apple publishes every app's current store version at a public endpoint:

```
https://itunes.apple.com/lookup?bundleId=app.lovable.f745440093af4f4390a60d52ff08c778
```

The response includes `version` (e.g. `1.0.3`). We compare that to the version baked into the installed app (read via `@capacitor/app` → `App.getInfo().version`). If the store version is higher, we prompt. That's it — Apple is the source of truth, so every new build automatically triggers the prompt the moment Apple finishes processing it.

> Note: this works for **native binary updates** only (new TestFlight / App Store releases). Pure JS/CSS changes pushed through Lovable already reach users on next launch via the WebView — no prompt needed for those.

## UX

- Trigger: on app launch + after successful login, native iOS only
- Check at most once per 6 hours (cached in `localStorage`)
- Dismissible dialog:
  - Title: "A new version of Familial is available"
  - Body: "You're on v{installed}. v{latest} is ready in the App Store."
  - Buttons: **Update Now** (opens App Store listing) · **Later** (dismisses for 24h)
- Never shown on web / PWA
- Respect "Later" — don't re-nag the same version until 24h elapse or a newer version appears

## Implementation

### 1. New util `src/lib/appVersionCheck.ts`
- `getInstalledVersion()` → `App.getInfo().version` (Capacitor)
- `getStoreVersion()` → fetch iTunes lookup, parse `results[0].version`
- `isUpdateAvailable(installed, latest)` → semver-ish compare
- 6-hour fetch cache + 24-hour "snoozed version" cache in `localStorage`

### 2. New component `src/components/shared/UpdatePrompt.tsx`
- Radix `Dialog`, mono B&W styling consistent with the app
- "Update Now" → `window.open('https://apps.apple.com/app/id<APP_ID>', '_system')` via `@capacitor/browser` or plain anchor
- "Later" → write snoozed version + timestamp to `localStorage`

### 3. Mount in `AppLayout.tsx`
- Inside `AppLayoutContent`, after auth succeeds, run the check in a `useEffect`
- Only runs when `Capacitor.isNativePlatform()` is true
- Also re-runs on `App` resume event (covers users who leave the app open for days)

### 4. App Store ID
- We need your numeric App Store ID (the `id123456789` in your App Store URL) to deep-link the Update button. If the app isn't live yet, we'll fall back to the TestFlight invite URL until launch.

## Files affected

- `src/lib/appVersionCheck.ts` (new)
- `src/components/shared/UpdatePrompt.tsx` (new)
- `src/components/layout/AppLayout.tsx` (mount the prompt)

No database changes. No edge functions. No admin UI. Ship a build → users get prompted.

## One thing I need from you

Your App Store numeric ID (or confirmation that we should use the TestFlight public link for now).
