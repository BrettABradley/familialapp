## Problem

In group chats, only the creator sees actions in the header (Edit / Delete). Non-creators have no way to leave — they're stuck in the chat forever unless the creator removes them or deletes the group.

Database is already fine: the RLS policy "Users can leave group chats" on `group_chat_members` allows `auth.uid() = user_id` deletes. So no schema work is needed — purely a UI gap.

## Fix

In `src/pages/Messages.tsx`, add a "Leave" action that shows for every member who is **not** the creator of the selected group chat.

### Changes (single file: `src/pages/Messages.tsx`)

1. **New state:** `isLeaveGroupOpen` boolean for the confirmation dialog.

2. **New handler `handleLeaveGroup`:**
   - `await supabase.from("group_chat_members").delete().eq("group_chat_id", selectedGroup.id).eq("user_id", user.id)`
   - On success: clear `selectedGroup`, switch back to chat list, remove the group from local `groupChats` state, close the dialog, toast "You left the group".
   - On error: toast the error.

3. **Header button (line ~899):** Replace the creator-only block so:
   - Creator (`selectedGroup.created_by === user.id`) → shows Edit + Delete (current behavior).
   - Non-creator → shows a single ghost icon button (`LogOut` from lucide) that opens the Leave confirmation dialog.

4. **New AlertDialog** (mirrors the existing Delete Group dialog):
   - Title: "Leave Group Chat"
   - Description: "You'll stop receiving messages from \"{name}\". You can be re-added by the group creator."
   - Cancel + destructive "Leave" action calling `handleLeaveGroup`.

No edge function or migration needed. Existing RLS policy already permits the delete.

## Files touched

- `src/pages/Messages.tsx` — add state, handler, header button branch, and confirmation dialog.
