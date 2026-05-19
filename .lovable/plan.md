## Diagnosis: push notifications are silently failing at registration

I checked the production database and edge function logs:

| Check | Result |
|---|---|
| Rows in `push_tokens` table | **0** |
| Invocations of `register-push-token` edge function | **0** |
| Invocations of `send-push-notification` edge function | **0** |
| Notifications created in last 7 days | 25 |
| APNs secrets (`APPLE_KEY_ID`, `APPLE_ISSUER_ID`, `APPLE_PRIVATE_KEY`) | ✅ all present |
| `apns-topic` vs bundle ID | ✅ match (`com.familialmedia.familial`) |
| DB triggers `on_notification_insert_push` + `trigger_push_notification` | ✅ installed |

**No device has ever successfully sent a token to the server.** That's why nothing arrives — the send pipeline has no tokens to target.

## Root cause

The iOS permission prompt your users accepted is shown **before** APNs registration is attempted. After they tap "Allow", iOS tries to contact APNs to issue a device token — and that step is failing silently because the **Push Notifications capability is missing from your Xcode project's entitlements file**.

Without `aps-environment` in `App.entitlements`, iOS:
- still shows the permission dialog ✅ (it's just an OS prompt)
- runs `requestPermissions()` → returns `granted` ✅
- runs `register()` → **APNs returns no token, `registrationError` fires instead** ❌
- our token-upload code never runs → DB stays empty ❌

This is the #1 cause of "users accepted but nothing arrives" on TestFlight, and your existing `scripts/ios-post-sync.sh` already documents it in a comment but cannot fix it from a script (Xcode entitlements must be enabled once via the IDE).

## Fix — three parts

### Part 1: Xcode capability (one-time, you do this)

1. Open `ios/App/App.xcworkspace` in Xcode
2. Select the **App** target → **Signing & Capabilities** tab
3. Click **+ Capability** → choose **Push Notifications**
4. Confirm an `App.entitlements` file is created/updated containing:
   ```xml
   <key>aps-environment</key>
   <string>production</string>
   ```
5. **Product → Clean Build Folder**, then Archive and upload to TestFlight
6. Reinstall the TestFlight build on your phone and sign in

Once this is done a single time, every future build inherits it.

### Part 2: Defensive logging so we can verify it worked

I'll improve `src/lib/pushNotifications.ts` to surface the registration result visibly:

- Log every state transition (`permission-status`, `register-called`, `token-received`, `token-uploaded`, `registration-error`) with structured prefixes so you can grep them in Safari Web Inspector during TestFlight QA.
- If a `registrationError` fires with the classic "no valid 'aps-environment' entitlement" message, log a clear actionable hint ("Add Push Notifications capability in Xcode").
- Re-run registration on every `SIGNED_IN` event by clearing `registrationAttempted` when auth state changes (currently the in-memory flag persists across logout/login in the same app session, which silently no-ops a second sign-in on a shared device).

### Part 3: Self-test edge function — `push-self-test`

A new authenticated edge function that:
1. Looks up the calling user's `push_tokens`
2. Sends a single test APNs payload to each
3. Returns the per-token result (`{ ok, status, reason }`)

I'll wire a small **"Send test push"** button into `Settings.tsx` (only visible on native iOS) so you can verify end-to-end from your own device in 5 seconds without waiting for a notification trigger.

## Files affected

- `src/lib/pushNotifications.ts` — better logging + retry on re-auth
- `src/pages/Settings.tsx` — "Send test push" button (native iOS only)
- `supabase/functions/push-self-test/index.ts` — new function
- `supabase/config.toml` — register the new function

No DB migrations. No changes to the existing send pipeline.

## How you'll verify the fix

After completing Part 1 and reinstalling from TestFlight:

1. Sign in on the device → check Safari Web Inspector for `[push] token-uploaded` log
2. Open Settings → tap **Send test push** → an APNs notification should appear within ~3 seconds
3. I'll re-query `push_tokens` and confirm a row exists for your user

If step 1 doesn't log `token-uploaded`, the entitlement still isn't right and we'll see the exact `registrationError` reason in the console — no more guessing.
