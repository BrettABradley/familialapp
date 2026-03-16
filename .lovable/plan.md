

## Plan: Fix "Failed to send message" error

### Investigation findings

- The insert code for both DMs and group messages looks structurally correct
- RLS policies are straightforward: DM insert requires `auth.uid() = sender_id`; group insert requires membership
- **No triggers are attached** to `private_messages` or `group_chat_messages` tables, so trigger failures are not the cause
- Console logs and network requests are empty (user is on landing page now, not reproducing in real-time)

### Most likely causes

1. **Stale auth session**: The `user` object exists in React state but the Supabase JWT may have expired, causing `auth.uid()` to be NULL and RLS to reject the insert
2. **Empty content edge case**: When sending only attachments, `content` is set to `""` — while Postgres allows this, some edge in the flow may not handle it well

### Changes

**File: `src/pages/Messages.tsx`**

1. **Refresh session before sending** — call `supabase.auth.getSession()` at the top of `handleSendMessage` to ensure the token is fresh before the insert
2. **Improve error visibility** — if the error object has a `code` or `details` field, include it in the toast so the exact cause is surfaced
3. **Guard against missing session** — if session refresh returns no user, show a "Please sign in again" toast and return early instead of attempting the insert

This is a small, focused change to `handleSendMessage` only.

