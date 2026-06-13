## Problem

When a message push notification opens a DM or group chat, the in‑chat back arrow only clears React state — it never pops the synthetic history entry we push when a chat opens. The result on iOS / native:

1. Push tap → `navigate('/messages?circle=X&thread=USERID')`
2. Messages opens the chat → effect calls `history.pushState({familialChat:true}, '')` (sentinel)
3. User taps the in‑chat back arrow → `handleExitChat()` clears state, but the sentinel stays on the stack
4. Next back (swipe‑back / nav back) pops the orphan sentinel → `popstate` fires → `handleExitChat()` runs again as a no‑op → the user sees "nothing happened" and has to press back a second time to actually leave Messages

Cold‑launching from a notification makes this worse because the history stack is very shallow, so the dead sentinel is the next thing in line.

## Fix

Front‑end only. No business‑logic, no DB, no push pipeline changes.

### `src/pages/Messages.tsx`

1. **Track sentinel ownership with a ref** (`sentinelPushedRef`). Set it `true` after `history.pushState({familialChat:true}, '')`, set it `false` inside the `popstate` listener and after we consume it via `history.back()`.

2. **Guard the sentinel‑push effect** so we never stack two sentinels if the deep‑link effect re‑opens a chat while one is already open (e.g. a second notification tap while in a chat).

3. **Route every manual chat exit through the sentinel**:
   - Refactor `handleExitChat` into `closeChatState()` (pure state reset) and a public `handleExitChat()` that:
     - if `sentinelPushedRef.current` → call `window.history.back()` (lets the existing `popstate` listener clear state exactly once)
     - else → call `closeChatState()` directly
   - Update the `popstate` listener to call `closeChatState()` (not the public `handleExitChat`) and flip the ref to `false`, so it cannot recursively re‑invoke `history.back()`.
   - Apply the same path to the other call sites that already reset chat state inline (`handleDeleteGroup`, `handleLeaveGroup`, `handleDeletePrivateConversation`) so they also consume the sentinel when present.

4. **Parity for the DM deep‑link effect** (lines 331‑345): also call `setChatView("dm")` explicitly, matching the group handler. This avoids a one‑render window where `selectedUser` is set but `chatView` is still `"list"`, which currently skips the sentinel push for that frame.

### Out of scope

- `src/lib/pushNotifications.ts` and `src/App.tsx` deep‑link bridge stay as‑is — they correctly use React Router `navigate(link)`.
- No changes to the push edge function, RLS, or notification payload shape.

## Verification

1. Cold‑launch from a DM push → chat opens → tap header back arrow once → lands on conversations list on the first tap.
2. From conversations list, swipe‑back / nav back → leaves Messages on the first tap (no orphan sentinel).
3. Warm app already on `/circles` → tap message push → chat opens → back arrow → conversations list → back → `/circles`.
4. Tap a second message push while a chat is already open → switches to the new chat with exactly one sentinel on the stack (back still closes in one tap).
5. Group chat push behaves identically to DM push.
6. Deleting / leaving a chat from inside the chat view closes cleanly without leaving a dead sentinel.
