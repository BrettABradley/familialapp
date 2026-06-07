# Fix: Password Reset + Outdated-Version App Store Link

## Issue 1 — Password reset link goes to the home/feed instead of `/reset-password`

**Root cause:** The early auth interceptor in `index.html` (lines 65–75) catches **any** URL hash containing `type=recovery`, `type=signup`, `type=magiclink`, etc. and unconditionally redirects to `/auth/callback`. `AuthCallback` then exchanges the code for a session and routes the user to `/circles`. The `ResetPassword` page never gets a chance to render, so there's no way to set a new password.

**Fix (in `index.html`):** When the hash/search contains `type=recovery`, redirect to `/reset-password` instead of `/auth/callback`. All other auth types (signup / magiclink / invite) keep their current behavior.

```js
// inside the existing interceptor
if (!isAuthLanding && looksLikeAuthHash) {
  var isRecovery = /type=recovery/.test(hash) || /type=recovery/.test(search);
  var target = isRecovery ? "/reset-password" : "/auth/callback";
  window.location.replace(target + search + hash);
  return;
}
```

`ResetPassword.tsx` already listens for `PASSWORD_RECOVERY` / `SIGNED_IN` events and checks `getSession()`, so once the URL lands there supabase-js will detect the recovery session and the form renders correctly.

No change needed in `src/pages/Index.tsx` (its own recovery redirect is a fallback for cases where the interceptor didn't fire — still valid).

## Issue 2 — "Outdated version" prompt doesn't open the App Store on iOS

**Root cause:** `src/components/UpdateGate.tsx` uses `window.open(url, "_blank")` to open the store URL. Inside the Capacitor WebView, `window.open` with `_blank` is unreliable — it often does nothing instead of handing the URL to Safari/App Store. Also, the `store_url` row in `app_version_config` is `https://apps.apple.com/app/id6760382623` (no `/us/app/familial/`), which works but is not the link you specified.

**Fix:**

1. **`src/components/UpdateGate.tsx`** — replace `openStore` with a native-aware opener:
   - On native: dynamically import `@capacitor/browser` and call `Browser.open({ url })`. Fall back to `window.location.href = url` if the plugin fails.
   - On web: keep `window.open(url, "_blank")`.

2. **DB migration** — update the store URL to the canonical link you want:
   ```sql
   update public.app_version_config
   set store_url = 'https://apps.apple.com/us/app/familial/id6760382623'
   where platform = 'ios';
   ```

3. **(Already correct, no change)** `UpdatePrompt.tsx` already uses `Browser.open` with a `window.open` fallback — that path works. The hard force-update gate in `UpdateGate.tsx` is what was failing.

## Files changed

- `index.html` — route `type=recovery` to `/reset-password`
- `src/components/UpdateGate.tsx` — use Capacitor `Browser.open` on native
- New migration — update `app_version_config.store_url` for iOS

## Verification

- Web: click the password reset email link → lands on `/reset-password` with the "Set New Password" form (not the home page). Submitting updates the password and routes to `/circles`.
- iOS: with installed version below `min_supported_version`, the full-screen "Update Required" gate's **Open App Store** button now launches Safari → App Store at the new URL.

## Out of scope

No changes to auth provider, RLS, or the email template itself. The Supabase recovery email already points to `https://familialapp.lovable.app/...#type=recovery&access_token=...` — the interceptor change is all that's needed to route it correctly.
