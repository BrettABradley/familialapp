

## Fix: Mobile message send refresh, input zoom, and keyboard domain bar

### Problem 1: Screen refresh on send (critical)
The `fetchConversations()` function (line 219) sets `isLoadingConversations = true` (line 221). The render logic on line 682 checks `isLoadingConversations` **before** checking the chat view on line 708. So when `fetchConversations` is called after sending a message (line 558) or by the realtime listener (line 167), the entire chat view unmounts and shows skeleton loaders — even though the user is actively in a conversation.

**Fix in `src/pages/Messages.tsx`:**
- Move the chat view rendering (`chatView === "dm"` and `chatView === "group"`) **before** the loading/skeleton check, so the active chat never unmounts due to background conversation list loading
- In `fetchConversations`, remove the `setIsLoadingConversations(true)` when conversations are already populated (same pattern as the feed fix — only show skeletons on initial empty load)
- In the realtime DM listener (line 160), skip refetching conversations for messages the user just sent (the optimistic update already handled it)

### Problem 2: iOS zoom on input focus
Even though `maximum-scale=1.0` is set in the viewport meta tag, iOS Safari can still zoom if the input font size is below 16px. The message `Input` component gets `h-9` class which makes it compact, and while the base Input uses `text-base` on mobile, adding an explicit `text-base` or `text-[16px]` class to the message input will ensure no zoom occurs.

**Fix:** Add `text-[16px]` class to the message Input on line 662.

### Problem 3: Domain bar above keyboard
The "familialmedia.com" bar above the keyboard is iOS Safari's native keyboard accessory bar. This **cannot be removed** in a standard web app — it's a browser-level UI element. The only way to suppress it is by running as a native app (via Capacitor/PWA home screen install). No code change needed here.

### Summary of changes

**File: `src/pages/Messages.tsx`**
1. Reorder render logic: check `chatView === "dm"` and `chatView === "group"` before the loading skeleton gate
2. Make `fetchConversations` only show loading skeleton on first load (when `conversations.length === 0`)
3. In realtime DM listener, skip processing if the new message was sent by the current user (already handled optimistically)
4. Add `text-[16px]` to the message Input to prevent iOS zoom

