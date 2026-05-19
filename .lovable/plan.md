
## 1. Fix iOS freeze when tapping the group-chat Edit (pencil) button

**Cause:** The "Edit Group Name" dialog in `src/pages/Messages.tsx` (lines 852–863) uses a plain shadcn `Dialog` containing an `<Input>`. On iOS with Capacitor's `resize: body` keyboard mode, opening a Dialog inside the messages screen (which already has its own fixed-height/keyboard layout architecture) auto-focuses the input, fires the keyboard resize, and the Radix focus-trap clashes with the messages portal/scroll setup — the WebView locks up. This matches the existing memory note `features/messaging-system/mobile-ui-architecture` (portal-to-body + `--keyboard-height` tracking is required for any input shown over the chat screen).

**Fix:**
- Rebuild the Edit Group Name dialog the same way DMs handle inputs: portal the `DialogContent` to `document.body`, give it the viewport-height + safe-area padding pattern, and add `onOpenAutoFocus={(e) => e.preventDefault()}` so iOS doesn't immediately raise the keyboard before the dialog finishes mounting.
- Use a controlled focus via `setTimeout(() => inputRef.current?.focus(), 150)` after the dialog animation completes.
- Apply the same treatment to the View Members and Delete Group dialogs while we're here, since they share the trigger row.
- Verify by re-checking the screen on the iOS WebView (cap sync) — no other code paths need to change.

## 2. Haptic feedback

Install `@capacitor/haptics` and add a tiny wrapper `src/lib/haptics.ts` that no-ops on web:

```ts
haptic.light()    // typing keystrokes, small taps
haptic.medium()   // button presses, post submit
haptic.selection()// list/tab selection
haptic.success() / .warning() / .error() // toasts
```

Wire it into:
- **Typing**: `MentionInput`, message Textarea in `Messages.tsx`, comment input in `PostCard`, `CreatePostForm` — fire `haptic.selection()` throttled (every ~5 keystrokes) on `onKeyDown` so it isn't overwhelming.
- **Posts / reactions**: `PostCard` reaction button → `light`; submit post → `medium` + `success` on toast; submit comment → `light`.
- **Messages**: send button → `medium`; receiving new message while screen visible → `light`.
- **Fridge / Campfire / Album upload**: pin, story tap, album create → `medium`.
- **Bottom nav** (`MobileNavigation`) → `selection` on tab change.
- **Pull-to-refresh** trigger → `light`.

All calls are wrapped so web users see no effect and there's no extra bundle on native if the plugin import fails.

User must run `npx cap sync ios --legacy-peer-deps` after pulling (already documented in memory).

## 3. Email notifications

Three new triggers, all delivered through the existing Lovable Emails transactional pipeline (`send-transactional-email` + queue) so they get retry/suppression/unsubscribe handling for free.

### 3a. New transactional templates
Create three React Email templates in `supabase/functions/_shared/transactional-email-templates/`:
- `mention-notification.tsx` — "{actorName} mentioned you in {circleName}" with a deep link to the post/comment.
- `unseen-message.tsx` — "You have unread messages from {senderName}" (sent once per sender per quiet-hour window).
- `new-album.tsx` — "{actorName} shared a new album '{albumTitle}' in {circleName}".

Register each in `registry.ts`. All use the existing monochrome / Playfair branding.

### 3b. Per-user preferences
Add columns to `profiles` (migration):
- `email_on_mention boolean default true`
- `email_on_unread_dm boolean default true`
- `email_on_new_album boolean default true`

Surface three toggles in `Settings.tsx` under a new "Email notifications" card. Existing unsubscribe-token system already covers global opt-out.

### 3c. Mention trigger
`mentions` (or wherever `@username` gets resolved when creating a post/comment) — after the in-app notification is inserted, call `send-transactional-email` with `templateName: "mention-notification"`, `idempotencyKey: \`mention-${notificationId}\``. Respect the user's `email_on_mention` flag and suppression list.

### 3d. New-album trigger
In the album-create flow (`Albums.tsx` → after `insert`), fan out one email per circle member (excluding the creator and read-only users). Each send is an individual `send-transactional-email` invocation with `idempotencyKey: \`album-${albumId}-${memberId}\`` — this stays inside the "one recipient per trigger" rule because each member's email is a distinct event keyed off the same album.

### 3e. Unseen-DM trigger (the trickiest)
Goal: if a DM (or group chat message) remains unread for ≥60 minutes and the recipient hasn't opened the conversation, send one digest email per sender (not per message), and don't re-email until they read it and a new unseen window starts.

Implementation:
- New table `pending_unread_email_notifications(recipient_id, sender_id, conversation_id, conversation_type, first_unread_at, last_message_at, email_sent_at)` with unique `(recipient_id, sender_id, conversation_type)`.
- DB trigger on `direct_messages` / `group_chat_messages` AFTER INSERT: upsert a pending row (set `first_unread_at = now()` only if no existing row, update `last_message_at` always).
- When messages are marked read (existing read-receipt flow), DELETE the matching pending row.
- New edge function `send-unread-message-emails` scheduled by pg_cron every 10 minutes: SELECT rows where `now() - first_unread_at >= interval '1 hour'` AND `email_sent_at IS NULL`, send the email, then mark `email_sent_at = now()`. The row is only deleted when the user actually reads the conversation, preventing repeat emails for the same window.

### 3f. Push + email coexistence
Push notifications fire instantly (already wired via `trigger_push_notification`); email is the slower fallback for mentions/albums and the 1-hour digest for missed DMs. They don't interfere — different `notifications` rows aren't created by the email job.

## Technical notes

```text
Affected files
├─ src/pages/Messages.tsx                       (dialog fix)
├─ src/lib/haptics.ts                           (new)
├─ src/components/feed/PostCard.tsx             (haptics)
├─ src/components/feed/CreatePostForm.tsx       (haptics)
├─ src/components/shared/MentionInput.tsx       (haptics)
├─ src/components/layout/MobileNavigation.tsx   (haptics)
├─ src/components/shared/PullToRefreshWrapper.tsx (haptics)
├─ src/pages/Settings.tsx                       (email pref toggles)
├─ src/pages/Albums.tsx                         (new-album email)
├─ supabase/functions/_shared/transactional-email-templates/
│   ├─ mention-notification.tsx                 (new)
│   ├─ unseen-message.tsx                       (new)
│   ├─ new-album.tsx                            (new)
│   └─ registry.ts                              (updated)
├─ supabase/functions/send-unread-message-emails/index.ts (new, cron)
└─ Migrations
    ├─ profiles email_on_* columns
    ├─ pending_unread_email_notifications table + RLS
    ├─ DM/group-msg insert + read triggers
    └─ pg_cron: every 10 minutes call send-unread-message-emails
```

Prereq: Lovable Emails / email infra already set up (`auth-email-hook` + `process-email-queue` are deployed). I'll verify domain status and run `setup_email_infra` + `scaffold_transactional_email` if either is missing before adding the new templates.

After merging, the user needs to `git pull` and run `npx cap sync ios --legacy-peer-deps` for the haptics plugin to be available on device.
