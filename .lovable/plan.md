## In-app "New update available" prompt

Detect when the user's installed iOS app version is older than the latest App Store version, then show a non-blocking prompt linking to the App Store listing.

### How it works

1. **Source of truth — Apple's iTunes Lookup API** (no key, no setup):
   `https://itunes.apple.com/lookup?bundleId=com.familialmedia.app&country=us`
   Returns the live App Store `version` (e.g. `73.0.1`).

2. **Compare against the installed version** using `@capacitor/app`'s `App.getInfo()` → returns `version` and `build` from Xcode (the fields in your screenshot).

3. **Semver compare**. If App Store version > installed version, show prompt.

4. **Prompt UX** — bottom sheet / dialog:
   - Title: "Update Available"
   - Body: "A new version of Familial (vX.X.X) is available on the App Store."
   - Buttons: **Update** (opens `https://apps.apple.com/app/id<APP_ID>`) and **Later**
   - "Later" dismisses for 24 hours via localStorage timestamp
   - Native-only (skip on web via `Capacitor.isNativePlatform()`)

5. **When it runs** — once on app launch after auth, with a 2s delay so it doesn't compete with splash.

### Files

- **New**: `src/hooks/useAppUpdateCheck.ts` — fetch + compare + dismissal state
- **New**: `src/components/UpdateAvailableDialog.tsx` — the prompt (shadcn Dialog, monochrome theme)
- **Edit**: `src/App.tsx` — mount `<UpdateAvailableDialog />` once inside the authed shell

### Required from you

- **App Store numeric app ID** (the `id######` from your App Store URL, e.g. `id6747...`). Needed for the "Update" button deep link. Bundle ID `com.familialmedia.app` we already have.

### Out of scope

- No force-update / blocking gate (can add later as a `minSupportedBuild` Supabase row if desired)
- No Android — iOS only for now (matches current Capacitor setup)
- Updating Version/Build in Xcode itself is manual per release; this only detects after you ship.
