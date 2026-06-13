# Fix: iOS push notifications silently broken

## What's actually wrong

Push notifications aren't reaching iOS because **the database trigger that calls `send-push-notification` is silently returning without ever firing the HTTP request**. The edge function itself is fine — it just never gets called.

### Evidence
- `pg_trigger`: `on_notification_insert_push` is enabled on `notifications` ✅
- 6 notifications were inserted in the last 24h (direct_message, mention, gift) ✅
- `net._http_response` for those timestamps (05:53, 07:59, 08:00 UTC today): **zero rows** ❌
- `net.http_request_queue`: empty ❌
- `send-push-notification` edge function logs: **no invocations at all**, only function boots from past deploys
- Cron-driven calls (e.g. `process-email-queue`) DO show up every 5 min, so `pg_net` itself is working

### Root cause
The current `public.trigger_push_notification()` (migrations `20260601041610` and `20260609194832`) reads `SUPABASE_SERVICE_ROLE_KEY` from `vault.decrypted_secrets`. On this project that lookup returns NULL, so the trigger hits this branch and quietly exits:

```sql
IF v_service_key IS NULL THEN
  RAISE LOG 'Skipping push notification for notification % - no service role key found in vault', NEW.id;
  RETURN NEW;
END IF;
```

This is also why the recent `trigger_notification_email` mention/new-album emails have stopped — same vault dependency, same silent skip.

`send-push-notification` requires a service-role caller (`isServiceRoleCaller`), so even if we sent the call without auth it would be rejected with 401. We need a credential the trigger can actually obtain without vault.

## The fix

Stop depending on `vault.decrypted_secrets`. Switch to a shared trigger secret that lives in two places we control:

1. **Postgres GUC** (`app.push_trigger_secret`) set via `ALTER DATABASE ... SET ...` in a migration, readable by the trigger with `current_setting(..., true)`.
2. **Lovable Cloud edge secret** (`PUSH_TRIGGER_SECRET`) with the same value, checked by the edge function.

The trigger passes the secret in an `x-trigger-secret` header. The edge function accepts the call if the header matches (in addition to the existing service-role path, which we keep for the `push-self-test` and any future admin invocations).

### Steps

1. **Generate a random secret value** (UUID) used in both step 2 and step 3.

2. **New migration** (`supabase/migrations/<ts>_fix_push_trigger.sql`):
   - `ALTER DATABASE postgres SET app.push_trigger_secret = '<uuid>';` so all new sessions inherit it.
   - `SELECT set_config('app.push_trigger_secret', '<uuid>', false);` so the current pg_net session sees it immediately.
   - `CREATE OR REPLACE FUNCTION public.trigger_push_notification()` that:
     - Hardcodes `v_url := 'https://qxkwxolssapayqyfdwqc.supabase.co'` (the fallback is already in the existing function).
     - Reads `v_secret := current_setting('app.push_trigger_secret', true)`.
     - If `v_secret IS NULL OR ''`, `RAISE LOG` and `RETURN NEW` (same safe no-op behavior).
     - Calls `net.http_post(...)` with headers `Content-Type`, `x-trigger-secret: v_secret` (drops `Authorization` / `apikey`).
   - Apply the same pattern to `public.trigger_notification_email()` so mention/new-album emails come back too.

3. **Add Lovable secret** `PUSH_TRIGGER_SECRET` = same uuid via `secrets--add_secret`.

4. **Update `supabase/functions/send-push-notification/index.ts`**:
   - Add a helper `isTriggerSecretCaller(req)` that compares `req.headers.get('x-trigger-secret')` to `Deno.env.get('PUSH_TRIGGER_SECRET')` using a constant-time check.
   - Change the auth gate from `if (!isServiceRoleCaller(...))` to `if (!isServiceRoleCaller(...) && !isTriggerSecretCaller(req))`.
   - Keep CORS headers, including `x-trigger-secret` in `Access-Control-Allow-Headers`.

5. **Verify** after deploy:
   - Insert a test row in `notifications` for the developer's own user_id (via psql) and confirm `net._http_response` records a 200 and `send-push-notification` logs `[push] dispatch ...`.
   - On a TestFlight build, send a DM to a second account and confirm a banner arrives on its iOS device.

## What stays the same
- Client `src/lib/pushNotifications.ts` (token registration + `registerForPushNotifications`) is healthy — 47 ios tokens are present in `push_tokens`.
- `register-push-token` / `unregister-push-token` edge functions unchanged.
- APNs JWT logic, APNs topic (`space.manus.familial.mobile.t20260223211425`), invalid-token cleanup all unchanged.
- iOS native config (entitlement, AppDelegate bridge, Info.plist) unchanged.

## Risks / notes
- `ALTER DATABASE postgres SET ...` requires the migration role to own the database. On Lovable Cloud the migration role does — same pattern is used by other Supabase projects for GUCs. If it fails at apply time, fall back to a small `private.trigger_config(key text primary key, value text)` table read by the trigger.
- Rotating `PUSH_TRIGGER_SECRET` later means re-running the migration with a new value AND updating the Lovable secret. Document this in the migration comment.
- Android FCM path is unaffected (same edge function, same auth gate fix benefits it equally).
