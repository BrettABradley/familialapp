## Add support@familialmedia.com as a co-moderator

Seed a second `platform_admins` row so the support inbox owner has full Moderation Console access alongside Brett.

### Steps

1. Look up the `auth.users.id` for `support@familialmedia.com`.
   - If the account exists → insert into `platform_admins (user_id)`.
   - If it does not exist yet → either (a) ask you to sign up that email first, or (b) add a one-time trigger that auto-promotes it to platform_admin on first signup. Recommend (a) — cleaner, no lingering trigger.
2. Verify by querying `platform_admins` joined to `auth.users` to confirm both Brett and support are listed.
3. No code or UI changes needed — `is_platform_admin()` already gates `/admin`, all `moderation-action` calls, and the admin-dashboard edge function, so the new seat works immediately.

### Quick check before I run it

Has `support@familialmedia.com` already signed up for a Familial account? If yes, I'll just insert the row. If no, sign up first (or tell me to add the auto-promote trigger) and I'll proceed.
