## What's actually happening

Today the verify link does land on `/auth/callback`, but Chrome still ends up signed in. Root cause:

- Supabase's verify endpoint redirects to `/auth/callback?code=…` (PKCE flow — token in the **query string**, not the hash).
- Our `index.html` early interceptor only looks for hash tokens (`access_token=`, `type=signup`). It never fires.
- `supabase-js` is created with `detectSessionInUrl: true`, so the moment `main.tsx` boots it sees `?code=` and silently calls `exchangeCodeForSession` → fires `SIGNED_IN` → `AuthProvider` sets `user`.
- The AppLayout / route guards see an authenticated user and navigate away from `/auth/callback` before its success screen can render. Hence "auto-signed into Chrome, no green check."

The `AuthCallback.tsx` web-path `signOut()` runs too late — it races a navigation that already happened.

## The fix

Intercept the PKCE code **before** `supabase-js` ever sees it, the same way we already do for hash tokens.

### 1. `index.html` — extend the early inline script

In the existing IIFE, before the module script loads:

- If `location.pathname === "/auth/callback"` AND `location.search` contains `code=` (and we're not native — `index.html` only runs in real web browsers, so this is implicit):
  - Stash the full original query string (`window.location.search`) and hash in `sessionStorage` under `familial:pendingVerifyParams`.
  - `history.replaceState({}, "", "/auth/callback")` to wipe `?code=…` from the URL so `detectSessionInUrl` finds nothing.
- Keep the existing hash-token branch for `/`, `/index.html`, etc.

This guarantees supabase-js boots into a clean URL on `/auth/callback` and never creates a session.

### 2. `src/pages/AuthCallback.tsx` — read the stashed params on web

In the web branch only:

- Read `sessionStorage.getItem("familial:pendingVerifyParams")` to recover the original `?code=…` / hash for error detection (so we can still show "Link expired" if Supabase returned `error_description`).
- Do **not** call `exchangeCodeForSession` (unchanged).
- Still set `familial:emailJustVerified = "1"`, still belt-and-suspenders `signOut()` + clear `sb-*-auth-token` keys (harmless no-op now), and render the green-check screen.
- Delete the stash key after reading.

Native branch is unchanged — Capacitor receives the deep link through `appUrlOpen` and `AuthCallback` exchanges the code normally so onboarding starts immediately.

### 3. Verify (no other changes)

- `useAuth.signUp` already pins `emailRedirectTo` to `https://familialapp.lovable.app/auth/callback` — keep as is.
- `AppLayout` already flashes the green-check toast when `familial:emailJustVerified === "1"` after sign-in — keep as is.
- No DB / edge function / email template changes needed.

## Expected flow after the fix

1. User taps **Verify Email** in Gmail on their phone/desktop.
2. Supabase verifies server-side, redirects to `https://familialapp.lovable.app/auth/callback?code=…`.
3. `index.html` strips `?code=…` instantly, before React/supabase-js mount. No session is ever created in this browser.
4. Green check + "Email verified — open the Familial app" renders. Browser stays signed out.
5. User opens the Familial app, signs in once → `AppLayout` mounts, sees the `emailJustVerified` flag, flashes a green-check toast, and the onboarding gate continues to circle creation.

## Out of scope

Auth email templates, rate-limit handling, Supabase auth config, and the `auth-email-hook` itself. This is purely a client-side URL-handoff fix.