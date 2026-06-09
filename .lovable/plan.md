## Goal
Restore push notifications end-to-end and make future failures visible instead of silent.

## What I found
- A fresh notification was created for Brett at `2026-06-09 19:52:44`.
- The database trigger did call `send-push-notification`.
- The function returned `401 Unauthorized`.
- Brett has push enabled and registered iOS tokens, so this is not a device-permission or preference issue.
- The push function still requires exact equality with `SUPABASE_SERVICE_ROLE_KEY`, while the database trigger is using a vault fallback key after the key rotation. Those no longer match.

## Implementation plan
1. **Fix push function auth compatibility**
   - Update `send-push-notification` to accept either:
     - a legacy JWT with role `service_role`, or
     - the current backend `SUPABASE_SERVICE_ROLE_KEY` exact match.
   - This mirrors the safer auth logic already used by `send-transactional-email`.

2. **Add push delivery diagnostics**
   - Log structured outcomes for every push invocation:
     - notification id
     - user id
     - token count
     - platform
     - sent count
     - cleaned invalid-token count
     - APNs/FCM error reason when provider rejects a token
   - This will let us distinguish: auth failure, no tokens, APNs rejection, FCM rejection, disabled preferences, or real successful send.

3. **Deploy and smoke test**
   - Deploy `send-push-notification`.
   - Insert or trigger a new notification for Brett.
   - Verify `net._http_response` returns `200` instead of `401`.
   - Check function logs for sent/skip/provider result.

4. **If provider still accepts but device does not display**
   - Then the server path is fixed and the remaining issue is iOS/APNs entitlement/topic/environment/device-token behavior.
   - I’ll use the new APNs response logs to pinpoint whether it is `BadDeviceToken`, `DeviceTokenNotForTopic`, sandbox/production mismatch, or a foreground-display/client handling issue.

## Files likely changed
- `supabase/functions/send-push-notification/index.ts`

## Out of scope
- No new iOS build unless APNs tells us the bundle/topic/entitlement itself is wrong.
- No schema changes unless logs reveal we need a persistent push audit table.