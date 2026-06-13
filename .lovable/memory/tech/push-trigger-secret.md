---
name: Push notification reliability + trigger secret
description: How push notifications are dispatched, retried, audited, and authenticated end-to-end.
type: tech
---

## Trigger path
`trigger_push_notification` (DB trigger on `public.notifications`) calls `pg_net.http_post` →
`send-push-notification` edge function with header `x-trigger-secret` whose value lives in
`private.trigger_config` (key `push_trigger_secret`). Edge function validates via
`get_trigger_secret` RPC and constant-time compare. Service-role bearer also accepted.

## Reliability (send-push-notification)
- Per-token retry: 3 attempts, 250ms / 1s / 2s backoff for transient (HTTP 429, 5xx, network).
- Permanent (APNs 410 / BadDeviceToken; FCM UNREGISTERED / NOT_FOUND / INVALID_ARGUMENT) → token deleted, no retry.
- Credential self-heal: APNs `InvalidProviderToken`/`ExpiredProviderToken` busts `cachedJwt` and retries once.
  FCM `UNAUTHENTICATED`/401 busts `cachedFcm` and retries once.
- 8s per-attempt timeout via `AbortController`.
- Parallel fan-out across a user's devices, concurrency capped at 10.
- Every attempt logs a row to `public.push_delivery_log` (`status` in sent / failed / invalid_token / skipped_pref / cred_failure).
- `push_tokens.last_used_at` bumped on every successful send (weekly cron may delete tokens unused 90+ days).
- On persistent credential failure, one-per-hour debounced `system_alert` notification fans out to platform admins.

## Health check
`push-credentials-health` edge function (platform-admin only) mints both an APNs JWT and an
FCM OAuth token and returns `{ apns, fcm }` without sending an actual push — use it to verify
Apple/Google credentials before troubleshooting "pushes aren't arriving".

## Required secrets
- `APPLE_KEY_ID` — 10-char Key ID from Apple Developer → Keys (APNs-enabled).
- `APPLE_ISSUER_ID` — 10-char **Team ID** (Membership page), NOT the App Store Connect Issuer UUID.
- `APPLE_PRIVATE_KEY` — full `.p8` contents including BEGIN/END lines.
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` + `FCM_PROJECT_ID` for Android.
