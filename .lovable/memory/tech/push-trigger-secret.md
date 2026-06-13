---
name: Push trigger secret (DB → edge function auth)
description: How DB triggers authenticate to send-push-notification and send-transactional-email without depending on vault
type: feature
---
Vault.decrypted_secrets returns NULL on this project, which silently broke `trigger_push_notification` and `trigger_notification_email` (they used to read SUPABASE_SERVICE_ROLE_KEY from vault).

Current pattern:
- Shared secret lives in `private.trigger_config` (key = `push_trigger_secret`). Schema `private` is locked to `service_role`.
- Triggers send `x-trigger-secret: <value>` plus the publishable anon key as `Authorization` (gateway requires *some* auth header even with `verify_jwt=false`).
- Edge functions verify by calling `public.get_trigger_secret('push_trigger_secret')` RPC via the service role and comparing constant-time. **Do NOT use `admin.schema('private').from('trigger_config')`** — PostgREST does not expose the `private` schema.
- `send-transactional-email` is `verify_jwt = false` so trigger calls reach the function.
- To rotate the secret: UPDATE the row in `private.trigger_config`. No code change, no env var needed.
- The `PUSH_TRIGGER_SECRET` Lovable secret exists but is unused — kept around as a deprecated fallback. Do not rely on it.
