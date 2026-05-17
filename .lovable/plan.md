# Why push isn't working

I dug into the actual code and database. The earlier description of push being "fully wired" was wrong — there are **two real gaps**:

1. **The app never registers for push.** There's no `@capacitor/push-notifications` plugin installed and no code anywhere that asks iOS for permission or sends a device token to the `register-push-token` edge function. The `push_tokens` table currently has **0 rows** — nobody has ever registered.
2. **The send function targets the wrong service.** `send-push-notification` POSTs to `https://exp.host/--/api/v2/push/send` (the Expo Push API). Expo's push service only accepts **Expo push tokens**, which require running inside the Expo runtime / EAS. This is a bare Capacitor app, so even if a token were registered it would be a raw APNs token and Expo would reject it.

The good news: the `APPLE_PRIVATE_KEY`, `APPLE_KEY_ID`, and `APPLE_ISSUER_ID` secrets are already configured (used for IAP receipt validation). The same APNs auth key can be used to send pushes directly to Apple, so no new credentials are needed.

# The fix

## 1. Add the Capacitor Push Notifications plugin

Install `@capacitor/push-notifications@^8` and register it. After install, the user will need to `npx cap sync ios` locally.

## 2. Add iOS-only registration on app launch

Extend `src/lib/capacitorInit.ts` so that when running natively on iOS and the user is authenticated:

- Request permission via `PushNotifications.requestPermissions()`
- If granted, call `PushNotifications.register()`
- On `registration` event, send the device token to the `register-push-token` edge function
- On `registrationError`, log it
- On `pushNotificationActionPerformed`, navigate to `notification.data.link` if present

Also call the registration step right after a successful sign-in (in `useAuth`) so first-time signups register without needing a relaunch.

## 3. Update Info.plist via post-sync script

Append to `scripts/ios-post-sync.sh`:

- Add `UIBackgroundModes` array containing `remote-notification`
- Add `aps-environment` entitlement is handled by Xcode capability, not plist — note this in the script as a comment so the user knows to enable "Push Notifications" capability in Xcode once (already enabled if APNs key works for the bundle id).

## 4. Rewrite `send-push-notification` to use APNs directly

Replace the Expo Push API call with a direct HTTP/2 POST to APNs:

- Build a JWT signed with ES256 using `APPLE_PRIVATE_KEY` + `APPLE_KEY_ID` + `APPLE_ISSUER_ID` (cache for ~50 min)
- POST to `https://api.push.apple.com/3/device/{token}` with headers `authorization: bearer <jwt>`, `apns-topic: com.familialmedia.familial`, `apns-push-type: alert`
- Body: `{ aps: { alert: { title, body: message }, sound: "default" }, type, link }`
- On HTTP 410 / `BadDeviceToken` / `Unregistered`, delete the token from `push_tokens`
- Keep all existing preference/muted-type checks unchanged

Deno can do HTTP/2 + ES256 JWT signing natively via `crypto.subtle`. No new npm deps needed.

## 5. Rename column (optional, deferred)

The DB column is `expo_token` but will now hold APNs tokens. Leave the column name alone for now to avoid a migration churn — just treat it as "device token". Add a comment in the edge function.

## 6. Verification steps after deploy

- Build a new iOS archive (this is a native code change — requires App Store submission, **not** an OTA web update)
- On first launch after install: confirm iOS prompts for notification permission
- Confirm a row appears in `push_tokens` for the logged-in user
- Trigger any in-app notification (e.g., have another user comment on your post) → push should arrive on the locked device

# Technical details

**Files touched:**
- `package.json` — add `@capacitor/push-notifications`
- `src/lib/capacitorInit.ts` — register + listeners
- `src/hooks/useAuth.tsx` — call register after sign-in (iOS only)
- `scripts/ios-post-sync.sh` — `UIBackgroundModes` = `remote-notification`
- `supabase/functions/send-push-notification/index.ts` — full rewrite to APNs HTTP/2 + ES256 JWT
- No DB migration, no new secrets

**Important caveat for the user:**
This is a **native code change**. It will require:
1. `npx cap sync ios` locally
2. A new build uploaded to App Store Connect
3. Apple review (should be fast — minor update post-approval)

Push will **not** start working from an OTA web update alone, because the `@capacitor/push-notifications` plugin must be compiled into the iOS binary.

**Xcode capability check (one-time, on user's Mac):**
Open `ios/App/App.xcworkspace` → Signing & Capabilities → ensure "Push Notifications" capability is added. If your APNs auth key (already in secrets) was created for this bundle ID and team, no new cert/provisioning is needed.
