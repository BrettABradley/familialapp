## Goal

Make sure when User A signs out and User B signs in on the same iPhone, push notifications start flowing to User B (and stop for User A) — reliably, even if the sign-out unregister call failed.

## What's already in place (from the last change)

1. **`signOut()`** calls `unregister-push-token` before clearing the session, so User A's row in `push_tokens` is deleted on a clean sign-out.
2. **`register-push-token`** has a `reclaim` step: before upserting, it deletes any row where the same APNs `device_token` is attached to a different `user_id`. So when User B signs in and the app re-registers, User A's stale row (if any) is wiped and User B's row takes its place.

This already covers the happy path for multi-account on one device.

## Gaps to close in this plan

To make it bulletproof for the multi-account case:

### 1. Force re-registration on every sign-in (not just first launch)

Today `pushNotifications.ts` has a session-scoped guard (`registrationWatchdog` / `lastRegisteredDeviceToken`) that prevents re-registering the same token twice in one app session. If User A signs out and User B signs in **without killing the app**, the guard could short-circuit and skip calling `register-push-token` — meaning the DB row would still point at User A's `user_id`.

**Fix:** In `useAuth.tsx`, on a successful sign-in (`SIGNED_IN` auth event), call `resetPushRegistrationState()` and then trigger `initPushNotifications()` again. This guarantees the token is re-uploaded under User B's JWT, which fires the `reclaim` step server-side and rewrites the row.

### 2. Re-register on `TOKEN_REFRESHED` for the active user

If User B is already signed in and the JWT refreshes, we don't need to re-register. But if the previous session belonged to User A and the same JS context now has User B's token, we want at least one upload under User B's identity. The sign-in handler above covers this; no extra work needed for token refresh.

### 3. Defense-in-depth: server-side cleanup on stale tokens

`trigger_push_notification` / the Expo sender already exists. When Expo returns `DeviceNotRegistered` (e.g., User A's phone uninstalled, or APNs rejected the old token), we should delete that row from `push_tokens`. Check the send-push edge function and, if it doesn't already handle the `DeviceNotRegistered` / `InvalidCredentials` response, add a small cleanup pass. This prevents long-term ghost rows and is the safety net if step 1 ever fails.

### 4. Verification path

After deploying:
- Sign in as User A on the device → confirm `push_tokens` has one row with `user_id = A`, `device_token = T`.
- Send User A a notification → arrives.
- Sign out → row for `(A, T)` gone.
- Sign in as User B on the same device → `push_tokens` has exactly one row: `user_id = B`, `device_token = T`. (Not two rows, no leftover A row.)
- Send User B a notification → arrives on the device.
- Send User A a notification → does NOT arrive on the device.
- Repeat without killing the app between sign-out/sign-in to exercise the guard reset.

## Files to touch

- `src/hooks/useAuth.tsx` — on `SIGNED_IN` event, call `resetPushRegistrationState()` then `initPushNotifications()`.
- `src/lib/pushNotifications.ts` — confirm `resetPushRegistrationState()` clears every guard (`lastRegisteredDeviceToken`, `registrationWatchdog`, any "already initialized" flag) so the next `initPushNotifications()` actually re-runs end-to-end.
- `supabase/functions/send-push` (or whichever function calls the Expo Push API) — on `DeviceNotRegistered` / `InvalidCredentials` response from Expo, delete the offending row from `push_tokens`. Read-only inspection first to see what's already there.

No DB migration. No schema changes. No new edge function beyond what already exists.

## Out of scope

- App uninstall detection (handled by the `DeviceNotRegistered` cleanup above).
- Switching accounts mid-notification-delivery (Expo will deliver to whatever token was current when the push was queued; acceptable).
