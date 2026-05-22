## Problem

Right now 2FA is bypassable:

1. In `src/pages/Auth.tsx`, after `signIn()` succeeds, Supabase fires `onAuthStateChange` → `user` becomes truthy → the redirect `useEffect` (line 132) immediately `navigate("/circles")` **before** the 2FA challenge can render. So users never see the OTP screen on login — they only see it if they manually open Settings.
2. Even if the challenge did render, the user is already fully authenticated. They could just type `/feed` in the URL bar and skip it. So 2FA isn't actually gating anything; it's cosmetic.

## Fix — make 2FA a real gate

Move the 2FA check out of the login form and into a session-level gate that wraps every authenticated route. The gate is authoritative: until the user enters a valid code in this session, they cannot reach any protected page.

### 1. New component `src/components/auth/TwoFactorGate.tsx`

Wraps `AppLayout`'s children. Behavior:

- Reads `profiles.two_factor_enabled` for the current user (uses `useCircleContext`'s profile if available, otherwise fetches once).
- Reads `sessionStorage.getItem("twoFactorVerified:" + user.id)`.
- If 2FA is **off** OR session flag is set → render children (pass-through).
- If 2FA is **on** AND not yet verified this session:
  - On mount, call `supabase.functions.invoke("send-2fa-code")` exactly once (guarded by a ref so React StrictMode doesn't double-send).
  - Render a full-screen OTP challenge UI (same look/copy as the one currently in `Auth.tsx` lines ~370–430 — 6-digit `InputOTP`, "Verify", "Resend code", "Cancel / Sign out").
  - On verify success → `sessionStorage.setItem("twoFactorVerified:" + user.id, "1")` and re-render children.
  - "Cancel" calls `signOut()` and sends user back to `/auth`.

Use `sessionStorage` (not `localStorage`) so the gate re-prompts on every fresh browser/tab session, which is the whole point of 2FA.

### 2. Wire the gate into the protected layout

In `src/components/layout/AppLayout.tsx`, wrap the existing authenticated render with `<TwoFactorGate>` (placed inside the `if (!user) return null;` check, around the `<TermsAcceptanceGate>` block). This guarantees no protected route renders without a verified code.

### 3. Strip the redundant 2FA branch from `Auth.tsx`

Remove the post-`signIn` block in `handleSubmit` (lines ~237–254) that fetches `two_factor_enabled`, calls `send-2fa-code`, and toggles `showEmailChallenge`. The gate now handles this. Also remove `showEmailChallenge`, `mfaCode`, and the inline OTP render in `Auth.tsx` so there's a single source of truth.

After this change, login flow becomes:
- User submits credentials → `signIn` succeeds → redirect effect navigates to `/circles` → `AppLayout` mounts → `TwoFactorGate` sees 2FA enabled, sends code, shows OTP screen → user enters code → gate marks session verified → app renders.

### 4. Clear the verified flag on sign-out

In `src/hooks/useAuth.tsx`'s `signOut`, clear all `twoFactorVerified:*` keys from `sessionStorage` (alongside the existing `sb-*-auth-token` cleanup). Also clear it in `AppLayout.handleSignOut` before the hard redirect to `/auth`.

### 5. (Bonus, low-risk) Add a "Cancel & sign out" affordance on the gate

If the user opens the email and doesn't have the code handy, they need an escape hatch. Provide a secondary button that calls `signOut()` then `window.location.href = "/auth"`.

## Files touched

- **NEW** `src/components/auth/TwoFactorGate.tsx`
- `src/components/layout/AppLayout.tsx` — wrap children in `<TwoFactorGate>`, clear session flag on sign-out
- `src/pages/Auth.tsx` — remove obsolete 2FA branch and OTP UI
- `src/hooks/useAuth.tsx` — clear `twoFactorVerified:*` session keys in `signOut`

No DB changes, no edge-function changes. `send-2fa-code` and `verify-2fa-code` already work correctly.

## Why this is the right shape

- **Survives navigation / URL typing** — the gate sits above every protected route.
- **Survives the auth-state race** — it doesn't depend on timing in the login form.
- **One source of truth** — Settings (enable/test) and login (enforce) both rely on the same two edge functions; only the *enforcement point* moves.
- **Session-scoped** — closing the tab requires a new code, matching standard 2FA UX.
