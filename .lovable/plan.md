# iOS Universal Links + Auth Keyboard Fix

Two remaining items from the verification gate work. Both are additive — no changes to existing auth behavior.

## 1. iOS Universal Links (Team ID: U7U8LZV7K8)

Goal: when a user taps the verification link in the email on iPhone, iOS opens the Familial app directly to the "Verified ✓" screen instead of Safari. If the app isn't installed, Safari opens the same `/auth/callback` page (already built) and verification still works.

### Files

**`public/.well-known/apple-app-site-association`** (new, no extension, served as JSON)
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "U7U8LZV7K8.app.lovable.f745440093af4f4390a60d52ff08c778",
        "paths": ["/auth/callback", "/auth/callback*"]
      }
    ]
  }
}
```
Served from `https://www.familialmedia.com/.well-known/apple-app-site-association` with `Content-Type: application/json` (Lovable hosting handles this automatically for files in `public/`).

**`scripts/ios-post-sync.sh`** — add an Associated Domains entitlement step:
- Patch `ios/App/App/App.entitlements` to include:
  ```xml
  <key>com.apple.developer.associated-domains</key>
  <array>
    <string>applinks:www.familialmedia.com</string>
    <string>applinks:familialmedia.com</string>
  </array>
  ```
- Idempotent (skip if already present).

**`src/App.tsx`** — `NativeUrlOpenBridge` already exists from the previous pass; no change needed. It already pushes `/auth/callback?...` into React Router when iOS hands us a universal link.

### What the user has to do once after this ships

1. In Apple Developer Console → Identifiers → `app.lovable.f745440093af4f4390a60d52ff08c778` → enable **Associated Domains** capability. (One-time, free.)
2. Republish the web app so the AASA file is live at `www.familialmedia.com/.well-known/apple-app-site-association`.
3. Run `npm run cap:sync:ios` and rebuild the iOS app in Xcode.

If step 1 isn't done, the link just opens Safari instead — no breakage, verification still works.

## 2. Auth.tsx Keyboard Fix (minimal)

Goal: on mobile, when the user taps an input near the bottom of the form (e.g. password during signup), the keyboard doesn't cover it.

### Changes (Auth.tsx only)

- Wrap the form card body in `<ScrollArea className="max-h-[calc(100vh-200px)] pb-32">`.
- Add `style={{ scrollMarginBottom: '120px' }}` to each `Input` (email, password, confirm password, 2FA code).
- No layout restructure, no sheet, no resize listener, no changes to the visual design.

This matches the pattern already proven on Events and Messages per the Keyboard UX memory.

## Guardrails

- No changes to `supabase/config.toml`, `useAuth.tsx`, `AppLayout.tsx`, or `AuthCallback.tsx` (already done).
- No changes to existing 2FA flow.
- Universal Links are opt-in at the OS level — if the AASA file isn't reachable or the entitlement isn't set, iOS silently falls back to Safari. Zero risk of breaking sign-in.
- The keyboard fix is purely presentational.
