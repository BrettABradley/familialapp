# Fixes: Chat back/scroll + Feed @everyone

## 1. Back button from bell → chat doesn't work

**Cause:** When a notification links to `/messages?thread=<userId>`, the deep-link `useEffect` (Messages.tsx ~296) re-opens the chat any time `selectedUser` becomes null while `threadParam` is still in the URL. The Android back / sentinel-popstate handler exits the chat, but the URL still has `?thread=`, so the effect immediately re-selects the user → user feels "stuck" in the chat.

**Fix:** Mirror the `?group=` pattern — strip `thread` from the URL once the chat is opened, and also strip it inside `handleExitChat`. This way back exits cleanly on iOS, Android, and web. (Single change in `src/pages/Messages.tsx`.)

## 2. Chat keeps scrolling down as images render

**Cause:** `useEffect` calls `messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })` on every `messages` change. As images in older messages finish loading, layout reflows and the smooth-scroll animation keeps re-triggering / fighting the user's manual scroll.

**Fix:**
- Track `isAtBottomRef` from the scroll container's scroll position (within ~80px of bottom).
- Only auto-scroll when (a) a message was sent by the current user, or (b) user was already pinned to the bottom when a new message arrived.
- Add `onLoad` to chat images: if `isAtBottomRef.current`, do an instant (non-smooth) scroll to bottom; otherwise do nothing. This stops the runaway scroll while keeping the "stay pinned" behavior people expect.
- Apply to both DM and group views.

Platform-agnostic — fixes iOS, Android, and web simultaneously.

## 3. `@everyone` in feed posts → push everyone in the circle

Scope: **Feed posts only** (not comments, not messages).

**Backend (migration):** New SECURITY DEFINER RPC `create_everyone_mention_notifications(_circle_id uuid, _post_id uuid)`:
- Verifies caller is a member/owner of the circle.
- Inserts one `notifications` row per other circle member with type `mention_everyone`, title "Everyone mention", message "<author> mentioned everyone in <circle>", and `link = /feed?circle=<id>&post=<id>`.
- Existing `notifications` insert trigger fans out push notifications to iOS/Android/web automatically — no edge function or platform-specific work needed.

**Frontend (`MentionInput` + `CreatePostForm`):**
- Add a synthetic "Everyone" entry to the mention suggestion list (always first when `@e…` matches).
- Detect literal `@everyone` token in submitted content via regex.
- After post insert, if matched, call the new RPC (in addition to existing `create_mention_notifications`).
- Show "@everyone" highlighted in the composer like other mentions.
- Update placeholder copy to hint at the feature.

## Technical Details

Files touched:
- `src/pages/Messages.tsx` — URL cleanup + scroll behavior.
- `src/components/shared/MentionInput.tsx` — "Everyone" suggestion entry.
- `src/components/feed/CreatePostForm.tsx` — detect `@everyone`, call new RPC.
- `supabase/migrations/<new>.sql` — `create_everyone_mention_notifications` RPC with membership check + EXECUTE grant to authenticated.

No iOS/Android rebuild required (all web bundle + DB).
