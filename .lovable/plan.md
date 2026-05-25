## Problem

Signing out clears the auth session but leaves the device's row in `push_tokens` intact. The push pipeline keeps targeting that row, so the phone continues to buzz for the user who signed out — and if a second user signs in on the same device, both users' notifications can land on it.

## Fix

Two coordinated changes:

1. **On sign-out**, delete this device's row from `push_tokens` before clearing the local session.
2. **On sign-in / re-register**, when a device token is registered to a new user, delete any rows for that same `device_token` under a different `user_id`. This handles "shared device" and "logged out, logged back in as someone else".

### Technical details

**A. New behavior in `register-push-token` edge function**

Before the upsert, run:

```ts
await admin
  .from("push_tokens")
  .delete()
  .eq("device_token", device_token)
  .neq("user_id", user.id);
```

Then upsert as today. This guarantees one APNs token → exactly one `user_id` at any time.

**B. New edge function `unregister-push-token`**

- POST `{ device_token }`
- Validates JWT, then deletes only the row matching `(user_id = caller, device_token = body.device_token)` via service-role client (RLS already allows the user to delete their own, but service-role keeps it consistent with `register-push-token`).
- Returns `{ success: true }` even if no row existed (idempotent).

Needed because we want the deletion to fire reliably during sign-out, and we want a single server endpoint we can also call from `delete-account` cleanup paths if useful later.

**C. Client: capture the current device token at registration time**

In `src/lib/pushNotifications.ts`, when `token-received` fires and we successfully upload, also stash the token value in a module-level variable (e.g. `lastRegisteredDeviceToken`) and export a getter `getRegisteredDeviceToken()`. This avoids re-querying APNs at sign-out time (which is async and can fail if permissions changed).

**D. Client: call unregister on sign-out**

In `src/hooks/useAuth.tsx` `signOut()`, **before** `supabase.auth.signOut()` (so the JWT is still valid):

```ts
if (Capacitor.isNativePlatform()) {
  const deviceToken = getRegisteredDeviceToken();
  if (deviceToken) {
    try {
      await supabase.functions.invoke("unregister-push-token", {
        body: { device_token: deviceToken },
      });
    } catch {
      // Non-fatal: server-side dedupe on next sign-in will clean it up.
    }
  }
}
```

Wrap in a short timeout (e.g. `Promise.race` with 2s) so a slow network doesn't block sign-out UX.

**E. Also clear the in-memory "already attempted this session" guard**

`pushNotifications.ts` has a session-scoped guard that prevents re-registration. Reset it on sign-out so the next user who signs in on the same device triggers a fresh registration (which then hits the dedupe logic in change A).

## Edge cases handled

- **Same device, same user signs back in** → register-push-token upsert is a no-op.
- **Same device, different user signs in** → change A deletes the prior row before upsert.
- **Sign-out with no network** → server-side dedupe (change A) cleans up next time anyone registers that token; worst case is one stray push before the next sign-in.
- **App uninstalled** → APNs eventually returns "unregistered" feedback; not addressed here (separate concern, handled by `send-push-notification` failure cleanup if/when added).
- **delete-account** already removes push tokens — no change needed there.

## Files touched

- `supabase/functions/register-push-token/index.ts` — add cross-user delete before upsert.
- `supabase/functions/unregister-push-token/index.ts` — **new**.
- `src/lib/pushNotifications.ts` — expose `getRegisteredDeviceToken()`, reset session guard on sign-out.
- `src/hooks/useAuth.tsx` — call `unregister-push-token` before `supabase.auth.signOut()`.

No DB schema migration required — `push_tokens` already has the right shape and RLS.

## Verification

1. Sign in on iPhone, confirm row appears in `push_tokens`.
2. Sign out. Confirm row is gone. Trigger a push (e.g. someone messages you) → phone stays silent.
3. Sign in as a **different** user on the same device → only the new user's row exists for that `device_token`. Push to old user → silent. Push to new user → arrives.
