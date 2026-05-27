## Goal
Land all 5 fixes from the prior plan, with extra emphasis on the chat back button always returning to the Messages list.

## 1. Back button — make it bulletproof (priority)
**Root cause:** the lightbox `<Dialog>` was rendered as a sibling of the chat view, mounted under `PullToRefreshWrapper`. Radix Dialog opens a portal + focus trap that re-renders the parent and clobbers `selectedUser` / `chatView` state, so back/X sometimes drops the user to the home tab instead of the Messages list.

**Fix:**
- Replace Radix Dialog usage in Messages with the shared `MediaLightbox` (already extracted) mounted **inside** the chat view tree (DM and Group views), so opening/closing it never unmounts the chat.
- Dedicated `handleExitChat()` helper used by every back/close affordance: synchronously `setSelectedUser(null); setChatView("list"); setLightbox(null); setMessages([]);` — never relies on Radix `onOpenChange`.
- Back arrow button: `type="button"`, `onClick` with `e.stopPropagation()` + `e.preventDefault()`, `min-h-[44px] min-w-[44px]` hit area, and an `onTouchEnd` fallback to defeat iOS ghost-click swallowing.
- Lightbox `onClose` only clears `lightbox` state — it must never touch `selectedUser` or `chatView`.
- Guard against Android hardware back / browser back leaving the user on a blank screen: when `selectedUser` is set, push a history entry on chat-enter and pop it on exit (same pattern already used elsewhere).

## 2. Double-send on iOS
- Add `const isSendingRef = useRef(false)` in `Messages.tsx`.
- At the top of `handleSendMessage`: if `isSendingRef.current` → return; else set it to true synchronously. Reset in a `finally` block.
- Send button: `type="button"`, single `onClick` that fires haptics then calls handler.

## 3. Audio posts wrongly blocked
- In `CreatePostForm.tsx`, before calling `moderate-content`, filter `mediaUrls` to images only (`getMediaType(path) === 'image'`).
- If `imageUrls.length === 0` and `text.trim() === ''` → skip the moderation call entirely.
- Audio/video remain unmoderated (unchanged from current intent).

## 4. Messages lightbox + “(attachment)” label + quality
- Use shared `src/components/shared/MediaLightbox.tsx` in both DM and Group chat views (already created).
- Replace inline `<img>` with `SmartImage preset="card"` so retina is crisp.
- Stop writing `"(attachment)"` as content when sending media-only messages — store empty string.
- Renderers (DM + Group): only render the `<p>{content}</p>` bubble text when `content?.trim()` is non-empty AND not the legacy literal `"(attachment)"`.

## 5. One image per message
- Drop `multiple` from the hidden file input; tighten `accept` to single image/* (voice notes still work — they go through `VoiceRecorder`, not the file input).
- `handleFileSelect`: cap to 1; if a pending attachment exists, replace it and toast "Replaced pending photo".
- Update the old "up to 4 files" toast copy to reflect 1-at-a-time.

## Files touched
- `src/pages/Messages.tsx` — lightbox swap, back-button hardening, send guard, one-image cap, `(attachment)` cleanup.
- `src/components/feed/CreatePostForm.tsx` — moderation payload filter.
- (Already in place) `src/components/shared/MediaLightbox.tsx`, `src/components/feed/PostCard.tsx`.

## Out of scope
- No DB, RLS, or edge-function changes.
- No redesign of Feed lightbox (just reused).
- No new audio/video moderation.

## Verification
- Open a DM → tap image → close lightbox → tap back → lands on Messages list (not home).
- Open a Group chat → same.
- Send the same message via rapid double-tap → only one row inserted.
- Post a voice note → no moderation toast, post stays up.
- Send a media-only message → no "(attachment)" caption visible.
- File picker only allows 1 image at a time.
