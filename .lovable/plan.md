## Context

You're transferring the Apple Developer account from Brett Allen Bradley → Familial LLC and keeping the same Bundle ID (`space.manus.familial.mobile.t20260223211425`). Android/FCM is unaffected. iOS push uses APNs token-based auth via three Lovable Cloud secrets — `APPLE_KEY_ID`, `APPLE_ISSUER_ID` (Team ID), `APPLE_PRIVATE_KEY` (.p8). The old `.p8` key was issued under the personal team and **stops working the moment Apple completes the transfer** (the key belongs to the old team, not the App ID's new team).

No code changes are needed because the Bundle ID and APNS topic stay identical. This is purely a credentials swap plus a token-table cleanup.

---

## Your side (Apple + Lovable Cloud secrets)

1. **Finish the App transfer in App Store Connect**
   - Personal account: Apps → Familial → App Information → "Transfer App"
   - Familial LLC account: accept transfer. Wait until status shows the app under the LLC team.

2. **Verify the App ID came across**
   - developer.apple.com → Certificates, IDs & Profiles → Identifiers → confirm `space.manus.familial.mobile.t20260223211425` is listed under Familial LLC and **Push Notifications capability is enabled**. Re-enable if missing.

3. **Generate a new APNs Auth Key under Familial LLC**
   - Keys → "+" → name "Familial APNs" → check **Apple Push Notifications service (APNs)** → Continue → Register
   - Download the `.p8` file (one-time download — save it).
   - Copy the **Key ID** (10 chars).
   - Copy the **Team ID** from the upper-right of developer.apple.com (Familial LLC team — different from the old personal Team ID).
   - Optional cleanup: revoke the old personal-account APNs key so it can't be reused.

4. **Update the three Lovable Cloud secrets** (Backend → Settings → Secrets):
   - `APPLE_KEY_ID` → new Key ID
   - `APPLE_ISSUER_ID` → new Familial LLC Team ID
   - `APPLE_PRIVATE_KEY` → full contents of the new `.p8` (including `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----` lines and the inner newlines)

5. **Rebuild & resubmit the iOS app under the new team**
   - In Xcode, change Signing & Capabilities → Team to Familial LLC; let it regenerate the provisioning profile (must include Push Notifications entitlement).
   - Bump build number, archive, upload to App Store Connect, ship a TestFlight build.
   - Device tokens are tied to the APNs environment + app install; tokens from the old-team build will return `BadDeviceToken` against the new key. Users get fresh tokens automatically the first time they launch the new build and the app re-registers.

6. **(Optional) Apple Sign In** — if you use BYOC Apple auth, the Services ID, .p8, and JWT secret also need to be regenerated under Familial LLC and re-pasted in Backend → Users → Auth Settings → Apple. If you're on Lovable's managed Apple auth (default), skip this.

---

## My side (code + database)

Only two small actions, both after you've finished steps 1–5:

A. **Purge stale iOS push tokens** so the send-push function stops hitting `BadDeviceToken` for old-team installs. One-line migration:
   ```sql
   DELETE FROM public.push_tokens WHERE platform = 'ios';
   ```
   The app re-registers and re-inserts a fresh token on next launch of the new build.

B. **Confirm `send-push-notification` is healthy** after secret rotation: tail edge-function logs while you trigger a test notification (e.g., react to a post). Expected: APNs returns 200. If we see `InvalidProviderToken` → the secrets were pasted wrong (usually `APPLE_PRIVATE_KEY` lost its newlines). If we see `BadDeviceToken` → there's still an old-team token in the table; re-run the purge.

No code in `send-push-notification/index.ts`, `capacitor.config.ts`, `ios-post-sync.sh`, or the APNS topic needs to change — they're all keyed off the Bundle ID, which is staying the same.

---

## Order of operations

```text
You: App transfer accepted in App Store Connect
You: App ID confirmed under Familial LLC w/ Push enabled
You: New APNs .p8 generated + Key ID + new Team ID captured
You: 3 Lovable Cloud secrets updated
You: New Xcode build signed by Familial LLC pushed to TestFlight
Me:  DELETE FROM push_tokens WHERE platform='ios' migration
Both: Trigger a test notification, watch edge-fn logs, confirm 200
```

## Out of scope

- Android/FCM (unchanged).
- Stripe account / Apple IAP agreements (separate workstream — let me know if those also moved and I'll plan them).
- In-app notification routing (the bell links — that work was finished in the previous turn and is unrelated to APNs).
