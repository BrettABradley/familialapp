

# Fix Apple App Review Rejections (3 Issues)

## Issue 1: Camera Crash on iPad (Guideline 2.1a)

**Root cause**: The `<input type="file" accept="image/*">` with the Camera button triggers the native camera picker. On iPad (Capacitor), this can crash if the app doesn't have proper camera permissions or if the Capacitor Camera plugin isn't configured.

**Fix**: 
- Install `@capacitor/camera` plugin and add it to `capacitorInit.ts` for permission handling
- In Settings.tsx (and other places using camera/file input for avatars), use Capacitor's Camera API on native platforms instead of raw `<input type="file">`. On web, keep the current file input.
- Create a utility function `pickImage()` in `src/lib/imagePicker.ts` that checks `Capacitor.isNativePlatform()`:
  - **Native**: Use `Camera.getPhoto()` with `CameraResultType.DataUrl` and `CameraSource.Prompt` (lets user choose camera or gallery)
  - **Web**: Fall back to programmatic file input click
- Update Settings.tsx, Circles.tsx, ProfileView.tsx, Messages.tsx, and other avatar/photo upload points to use this utility
- Add `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription` to `Info.plist` guidance for the user

## Issue 2: Upgrade Plan Button Redirects to Circles (Guideline 2.1a - App Completeness)

**Root cause**: On Capacitor/native, `window.location.href = data.url` to a Stripe Checkout URL may not work properly inside the webview — it can redirect back to the app's circles page instead of opening the Stripe payment page.

**Fix**:
- In `Pricing.tsx` and `UpgradePlanDialog.tsx`, detect native platform and use `import { Browser } from '@capacitor/browser'` to open the Stripe checkout URL in an in-app browser (`Browser.open({ url })`) instead of `window.location.href`
- Install `@capacitor/browser` 
- Create a utility `openExternalUrl(url: string)` that uses `Browser.open` on native and `window.location.href` on web
- Apply this to all Stripe checkout/portal URL redirects

## Issue 3: No Account Deletion Option (Guideline 5.1.1v)

**Fix**:
- Add a "Delete Account" section at the bottom of Settings.tsx, above the Sign Out button
- Show a red "Delete Account" button with destructive styling
- On tap, show an AlertDialog confirming the action with a warning: "This will permanently delete your account and all your data. This cannot be undone."
- Require the user to type "DELETE" to confirm (Apple requires it not to be too easy to accidentally delete)
- On confirmation, call a new `delete-account` edge function that:
  1. Deletes user's owned circles (or transfers them if needed)
  2. Removes circle memberships
  3. Deletes profile data
  4. Cancels any active Stripe subscription
  5. Calls `supabase.auth.admin.deleteUser(userId)` using the service role key
- After deletion, sign out and redirect to `/auth`

## Issue 4: iPad Optimization

**Fix**:
- Add responsive layout adjustments for iPad screen sizes (768px-1024px+)
- Ensure the app layout uses appropriate max-widths and padding for tablet displays
- Test that the navigation and main content areas use available space well on wider screens
- Add CSS media queries or Tailwind responsive classes where needed (the existing layout already uses `max-w-2xl`, `max-w-6xl` etc. which should work, but verify dialogs and cards don't look too narrow on iPad)

## Files to Create/Modify

| Action | File |
|--------|------|
| Install | `@capacitor/camera`, `@capacitor/browser` |
| Create | `src/lib/imagePicker.ts` |
| Create | `src/lib/externalUrl.ts` |
| Create | `supabase/functions/delete-account/index.ts` |
| Modify | `src/pages/Settings.tsx` — add Delete Account section |
| Modify | `src/pages/Settings.tsx` — use `pickImage()` instead of raw file input |
| Modify | `src/components/landing/Pricing.tsx` — use `openExternalUrl()` for checkout |
| Modify | `src/components/circles/UpgradePlanDialog.tsx` — use `openExternalUrl()` for checkout |
| Modify | `src/lib/capacitorInit.ts` — no changes needed (camera permissions are requested at use time) |
| DB Migration | None needed (deletion uses service role to cascade) |

## Post-Implementation

After implementing, user will need to:
1. `git pull` and `npm install`
2. `npx cap sync ios`
3. Add camera permission strings to `ios/App/App/Info.plist`
4. Rebuild and resubmit to Apple

