## Short answer

Yes — push notifications are broken by the **same family of bug**, but in a different spot. The email fix only patched `send-transactional-email`. Push has its own trigger + edge function pair that's silently failing for a closely related reason.

## What I checked

- `trigger_push_notification` (DB trigger on `notifications` insert) reads two values from `vault.decrypted_secrets`:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- If either is `NULL`, the trigger logs a notice and **returns without firing** — no HTTP call is made.
- `send-push-notification` itself is gated by exact-match: `Authorization === "Bearer " + SUPABASE_SERVICE_ROLE_KEY` (from env). If env and vault don't agree, the call would 401 even if it did fire.
- A notification was inserted yesterday at 18:19:55 UTC. `net._http_response` shows **zero** outbound requests in that window → the trigger never even called the function.
- `supabase--edge_function_logs` for `send-push-notification` returns **No logs found** → the function hasn't been invoked recently at all.
- The earlier Gayla resend migration had to fall back from `SUPABASE_SERVICE_ROLE_KEY` to `email_queue_service_role_key` to find a usable secret in vault — confirming the vault naming drifted after the key rotation.

So root cause: after the service-role key was rotated to the new `sb_secret_...` format, the vault secret named `SUPABASE_SERVICE_ROLE_KEY` is either missing or stale. Every DB trigger that uses `net.http_post` with vault-pulled creds (push, notification emails, etc.) silently no-ops.

## Plan

1. **Make `trigger_push_notification` resilient to vault naming**, mirroring what we did for the Gayla resend:
   - Look up the URL under `SUPABASE_URL`, then fall back to `project_url` / `supabase_url`; if still null, hardcode the project URL.
   - Look up the service key under `SUPABASE_SERVICE_ROLE_KEY`, then fall back to `email_queue_service_role_key` / `service_role_key`.
   - Keep the existing exception wrapper and `RAISE LOG` for diagnostics.

2. **Apply the same fix to `trigger_notification_email`** (it has the identical vault lookup and would also be silently no-opping for `mention` / `new_album` emails).

3. **Verify the edge function's auth check still matches.** `send-push-notification` does a strict equality check against `SUPABASE_SERVICE_ROLE_KEY` from `Deno.env`. The Lovable-managed env value is the current `sb_secret_...` key, and the trigger will now post that same key from vault (`email_queue_service_role_key` already holds the current key — that's how the queue worker still works). So once the trigger fires with the right bearer, the function will accept it. No code change needed in the function itself.

4. **Smoke test**: insert a self-targeted notification for an account with a registered push token (Brett — 42 iOS tokens are registered), then:
   - Check `net._http_response` for a fresh 200 around that timestamp.
   - Check `send-push-notification` edge function logs for the invocation and the APNs/FCM response.
   - Confirm device receipt.

5. **Optional hardening (recommended)**: have `email_domain--setup_email_infra` re-run later to refresh `email_queue_service_role_key` whenever Supabase rotates keys again, so we don't depend on a single fallback name. Not required for this fix.

## Out of scope

- Not touching `send-push-notification`'s auth logic, payload shape, APNs/FCM clients, or `push_tokens` schema.
- Not retroactively re-sending push notifications for the missed `notifications` rows from the last weeks — push is time-sensitive and re-sending stale activity would be confusing. Only future notifications will fire.
- Not changing the email transactional fix already shipped.

## Technical details

```text
notifications INSERT
  └─► trigger_push_notification (BROKEN: vault names mismatch → silent return)
        └─► net.http_post → send-push-notification → APNs (iOS) / FCM (Android)

notifications INSERT (mention | new_album)
  └─► trigger_notification_email (SAME BUG)
        └─► net.http_post → send-transactional-email (fix already in place client-side)
```

Migration shape (one migration, two `CREATE OR REPLACE FUNCTION` statements):

```sql
-- trigger_push_notification
SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets
  WHERE name IN ('SUPABASE_URL','project_url','supabase_url') ORDER BY name LIMIT 1;
SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets
  WHERE name IN ('SUPABASE_SERVICE_ROLE_KEY','email_queue_service_role_key','service_role_key')
  ORDER BY name LIMIT 1;
IF v_url IS NULL THEN v_url := 'https://qxkwxolssapayqyfdwqc.supabase.co'; END IF;
IF v_service_key IS NULL THEN
  RAISE LOG 'push trigger: no service key in vault for notification %', NEW.id;
  RETURN NEW;
END IF;
-- (rest unchanged)
```

Same shape for `trigger_notification_email`.
