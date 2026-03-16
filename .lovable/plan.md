
Fix the mobile messages view by changing how the active chat is rendered, not just its z-index.

### Root cause
The screenshot shows the main app header and bottom mobile nav are still visible while a conversation is open. That means the chat detail view is still being rendered inside the normal page/layout stacking context, so the composer ends up off-screen or blocked instead of owning the full mobile viewport.

### Plan
1. **Refactor the active DM/group chat into a true mobile full-screen layer**
   - Update `src/pages/Messages.tsx`
   - Render the open conversation in a mobile-only full-screen container that is not constrained by the normal page content area
   - Keep desktop behavior unchanged

2. **Use a safer rendering approach for mobile chat**
   - Prefer rendering the mobile chat detail via a portal to `document.body` so it sits above the app shell
   - This avoids the current issue where layout/header/navigation still win visually even with a higher z-index

3. **Pin the composer visibly at the bottom**
   - Keep the message input bar fixed/sticky inside that mobile chat layer
   - Add explicit bottom safe-area spacing and enough scroll padding so the last messages are never hidden behind the composer
   - Preserve the existing attachments, voice note, and send behavior

4. **Apply the same fix to both chat types**
   - Direct messages
   - Group chats

5. **Keep the existing usability improvements**
   - Preserve draft saving/restoring
   - Preserve read-only behavior
   - Preserve message list scrolling to the latest message

### Files to update
- `src/pages/Messages.tsx` — move mobile chat rendering to a true full-screen layer and anchor the composer correctly
- Possibly a small shared utility/import for portal rendering if needed, but likely this can stay inside `Messages.tsx`

### Expected result
On mobile, opening a conversation should behave like a native messaging screen:
- the conversation takes over the screen
- the bottom nav no longer remains visible behind it
- the message input bar is always visible and usable
- typing/sending works for both DMs and group chats
