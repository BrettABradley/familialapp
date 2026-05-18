
## Context

Your push backend is **already self-hosted** — `send-push-notification` signs an ES256 JWT with your `.p8` key and POSTs directly to `https://api.push.apple.com`. No Expo dependency exists in the send path. Only the column name `expo_token` is legacy; it actually holds raw APNs device tokens from `@capacitor/push-notifications`.

This does **not** improve App Review approval odds — review never tests delivery. Approval depends on the entitlement + clean launch, both already handled. This pass is hygiene + a small dev-build fix.

## Changes

### 1. Rename `push_tokens.expo_token` → `device_token` (migration)
- `ALTER TABLE public.push_tokens RENAME COLUMN expo_token TO device_token;`
- Update unique constraint name if it references the old column.

### 2. Update `register-push-token` edge function
- Accept `{ device_token }` in the body (keep `expo_token` as a fallback alias for one release so cached app sessions don't break).
- Upsert on `(user_id, device_token)`.

### 3. Update `register-push-token` client call
- `src/lib/pushNotifications.ts`: send `{ device_token: token.value }` instead of `{ expo_token: token.value }`.

### 4. Update `send-push-notification` edge function
- Replace `expo_token` references with `device_token`.
- Read `APNS_ENV` env var; if `"sandbox"`, use `https://api.sandbox.push.apple.com`, otherwise `https://api.push.apple.com` (default = production).
- Remove the "legacy" comment now that the column name is honest.
- Update invalid-token cleanup `.in("device_token", invalidTokens)`.

### 5. Add `APNS_ENV` secret
- Use the secrets tool to add `APNS_ENV`. User sets it to `production` for TestFlight/App Store builds (default) or `sandbox` for local Xcode runs.

### 6. Doc updates
- `scripts/ios-post-sync.sh`: replace any Expo mentions with a short note that push uses direct APNs and requires `APPLE_KEY_ID`, `APPLE_ISSUER_ID`, `APPLE_PRIVATE_KEY`, optional `APNS_ENV`.
- Update `mem://tech/push-notification-infrastructure` memory to remove Expo references.

## What this does NOT change

- No client UX changes.
- No changes to `trigger_push_notification` DB function (still calls the same edge function).
- No App Review-affecting behavior — launch hardening from the previous pass stays as-is.

## After approval

Run:
```
git pull
npm install --legacy-peer-deps
npm run build
npm run cap:sync:ios
```
Then add `APNS_ENV=production` secret if you want explicit prod selection (otherwise it defaults to production).
