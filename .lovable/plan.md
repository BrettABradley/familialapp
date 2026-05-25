
## Build version to use

Set `package.json` → `"version": "66.0.1"` **right now** (matches the build currently live in the App Store). When you upload 67.0.1 to Apple, bump `package.json` to `"66.0.1"` → `"67.0.1"` in the **same commit** as the Xcode `CFBundleShortVersionString` bump. That way:

- Users on 66.0.1 (current store build) won't see a prompt until 67.0.1 is **approved and live** in the store.
- The moment Apple flips 67.0.1 to "Ready for Sale", iTunes Lookup returns `"version": "67.0.1"`, and every user still on 66.0.1 sees the dialog on next app launch.

Rule going forward: **bump `package.json` version to match the App Store build number on every release.** Never let them drift.

---

## Implementation steps

### 1. Update `package.json`
- Change `"version": "0.0.0"` → `"version": "66.0.1"`.

### 2. New file: `src/hooks/useAppUpdateCheck.ts`
- On mount, only run if `Capacitor.isNativePlatform()` is true.
- Read installed version via `App.getInfo()` (already have `@capacitor/app` installed).
- Check cache key `app_update_check` in `localStorage` — skip network call if checked < 6 hours ago.
- Fetch `https://itunes.apple.com/lookup?bundleId=app.lovable.f745440093af4f4390a60d52ff08c778&country=us`.
- Parse `results[0].version` and `results[0].trackViewUrl`.
- Semver-compare (simple `a.b.c` split + numeric compare — no extra dep needed).
- Return `{ updateAvailable: boolean, storeVersion: string, storeUrl: string }`.
- Silently swallow network errors (offline, App Store API hiccups) — never block the app.

### 3. New file: `src/components/UpdateAvailableDialog.tsx`
- shadcn `AlertDialog`. Soft prompt (Later + Update buttons).
- Copy: *"A new version of Familial is available (v{storeVersion}). Update now for the latest features and fixes."*
- "Later" → dismiss + write `update_dismissed_for_version` in `localStorage` so we don't re-prompt for that same version this session.
- "Update" → `Browser.open({ url: storeUrl })` from `@capacitor/browser` (already installed).
- Don't show again in this session once dismissed; show again on next cold launch.

### 4. Mount in `src/components/layout/AppLayout.tsx`
- Add `<UpdateAvailableDialog />` once, near the root. Hook handles all logic — component renders nothing unless `updateAvailable && !dismissedForThisVersion`.

### 5. Remove "Send test push" button — `src/pages/Settings.tsx`
- Delete lines 395–438 (the `isIOSNative() && (<Button>…</Button>)` block).
- Leave the `push-self-test` edge function deployed (no UI references it; idle cost is zero, useful for future diagnostics).

---

## After approval, you'll need to:

1. `git pull` your repo.
2. `npm install --legacy-peer-deps` (no new deps, but safe).
3. `npm run build`
4. `npx cap sync ios --legacy-peer-deps`
5. In Xcode, set **Version** to `67.0.1` (matches what's in `package.json` for that release), bump **Build** as usual, archive, upload.
6. Once Apple approves and the build is "Ready for Sale", existing 66.0.1 users see the prompt on their next launch.

## What this does NOT do

- No force-update mode (can add later as a flag if you ever ship a breaking schema change).
- No Android logic (iOS-only — Play Store lookup is different; we'll add it when you ship Android).
- No telemetry on update-prompt impressions/clicks (matches no-tracking policy).
