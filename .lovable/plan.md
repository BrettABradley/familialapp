## Continue Email Notification Wiring

Picking up where we left off: templates + send-transactional-email infra are deployed. Now wire the three triggers, add user prefs, and ship the cron-based unseen-DM digest.

### 1. DB Migration — preferences + unread tracking

Add to `profiles`:
- `email_on_mention boolean default true`
- `email_on_unread_dm boolean default true`
- `email_on_new_album boolean default true`

New table `pending_unread_email_notifications`:
- `recipient_id uuid`, `sender_id uuid`, `conversation_id uuid`, `conversation_type text` ('dm' | 'group')
- `first_unread_at timestamptz default now()`, `last_message_at timestamptz default now()`, `email_sent_at timestamptz`
- Unique `(recipient_id, sender_id, conversation_type, conversation_id)`
- RLS: service-role only (no client access needed)

DB triggers:
- AFTER INSERT on `direct_messages` → upsert pending row for recipient (only insert `first_unread_at` on conflict-do-nothing; always update `last_message_at`)
- AFTER INSERT on `group_chat_messages` → same, fan out per group member excluding sender
- On read-receipt update (existing flow) → DELETE matching pending row

### 2. Mention trigger
Hook into wherever `@mentions` resolve into a `notifications` row (likely in feed post/comment insert flow or DB trigger). After insert, call `send-transactional-email` with template `mention-notification`, `idempotencyKey: mention-${notificationId}`. Skip when recipient's `email_on_mention = false`.

### 3. New-album trigger
In `src/pages/Albums.tsx` after album insert, fetch active circle members (excluding creator + read-only), invoke `send-transactional-email` per member with `idempotencyKey: album-${albumId}-${memberId}`, respect `email_on_new_album`.

### 4. Unseen-DM cron — `send-unread-message-emails`
New edge function (scheduled via pg_cron every 10 min):
- SELECT pending rows where `now() - first_unread_at >= interval '1 hour'` AND `email_sent_at IS NULL`
- Join sender profile (name) + recipient profile (email + `email_on_unread_dm`)
- Send `unseen-message` template, set `email_sent_at = now()`
- Row stays until user reads → next unread window starts fresh

Add config.toml entry; schedule via `pg_cron` + `pg_net` (using insert tool since URL/anon key are project-specific).

### 5. Settings UI
Add "Email notifications" card to `src/pages/Settings.tsx` with three toggles writing to `profiles`.

### 6. Verification
- Deploy edge functions (`send-unread-message-emails`)
- Trigger a test mention + album + send a DM and wait 1hr (or temporarily lower threshold to validate)
- Check `email_send_log` for `sent` status per template

### Files affected
```text
src/pages/Settings.tsx                                       (toggles)
src/pages/Albums.tsx                                         (album email)
src/components/feed/CreatePostForm.tsx / PostCard.tsx        (mention email after comment/post)
supabase/functions/send-unread-message-emails/index.ts       (new)
supabase/config.toml                                         (new function)
Migrations:
  - profiles email_on_* columns
  - pending_unread_email_notifications + RLS
  - DM/group insert triggers + read-clear triggers
pg_cron schedule via insert tool
```

Ready to proceed — approving this will run the migration first, then wire the code.