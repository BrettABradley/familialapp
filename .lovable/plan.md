

# Harden Account Deletion for Other Users' Experience

## Problem
When a user deletes their account, their data is removed. But other users who interacted with them could experience issues:
- Profile joins returning `null` in feed comments/reactions (already partially handled with `?.` fallbacks)
- DMs being deleted on BOTH sides (the other person loses their conversation history)
- Group chat messages disappearing mid-conversation
- Foreign key join queries failing silently

## Current State
The UI already uses optional chaining (`post.profiles?.display_name || "Unknown"`) in PostCard, which prevents crashes. However, there are gaps.

## Changes

### 1. Edge Function: Stop deleting other people's DM history
**File: `supabase/functions/delete-account/index.ts`**

Currently the function deletes `private_messages` where `sender_id = userId` AND separately where `recipient_id = userId`. This wipes the other person's conversation too.

Instead: only delete messages where the user is the sender. For messages where they are the recipient, leave them intact so the other person keeps their sent message history. Or better: anonymize by keeping the messages but the profile is already gone — the other user just sees "Deleted User."

Actually the simplest safe approach: **don't delete DMs at all** — just let the profile deletion naturally make the sender show as "Unknown." The messages stay for the other person. Remove these two lines:
- `delete().eq("sender_id", userId)` 
- `delete().eq("recipient_id", userId)`

### 2. Edge Function: Keep group chat messages
Similarly, don't delete `group_chat_messages` where `sender_id = userId`. Other group members should still see the conversation flow — the sender will just show as "Deleted User."

### 3. UI: Add null-safe profile handling everywhere

**File: `src/pages/Messages.tsx`**
- In `fetchConversations`, handle case where a profile lookup returns no results for a user_id (deleted user)
- In group chat message rendering, handle missing profiles gracefully with "Deleted User" fallback

**File: `src/components/feed/PostCard.tsx`**  
- Already handles null profiles with `?.` — no changes needed

**File: `src/hooks/useFeedPosts.ts`**
- The Supabase join query will return `null` for the `profiles` relation when the profile is deleted — this is already safe since PostCard handles it

### 4. Messages page: Handle deleted conversation partners
**File: `src/pages/Messages.tsx`**
- When building conversation list, if a profile is not found for a user_id, show "Deleted User" with a default avatar instead of crashing or hiding the conversation
- When viewing a DM thread, if `selectedUser` profile is missing, show "Deleted User" header

## Summary of edge function changes

| Current behavior | New behavior |
|---|---|
| Deletes all DMs (both sender and recipient) | Keep DMs intact — profile deletion makes sender show as "Deleted User" |
| Deletes group chat messages | Keep group messages — sender shows as "Deleted User" |
| Everything else | Same — posts, comments, reactions by deleted user are still removed globally |

## Files to modify

| File | Change |
|------|--------|
| `supabase/functions/delete-account/index.ts` | Remove DM and group message deletion lines |
| `src/pages/Messages.tsx` | Add null-safe profile handling for deleted users in conversations and group chats |

