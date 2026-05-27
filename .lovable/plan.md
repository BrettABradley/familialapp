## Issues & Fixes

### 1. Audio logs always blocked as "against community guidelines"
**Cause:** `src/components/feed/CreatePostForm.tsx` signs ALL uploaded media URLs (including audio and video) and sends them to `moderate-content` as `imageUrls`. The Gemini classifier receives an audio file as an `image_url` payload and either errors or returns "not allowed" → the post is auto-deleted with the generic guidelines toast.

**Fix:** Filter `mediaUrls` down to images only before signing (skip when `getMediaType(path)` is `audio` or `video`). If nothing is left to check and there's no text, skip the moderation call entirely. (Video/audio remain unmoderated for now — same as today's intended behavior; we just stop misclassifying them as unsafe images.)

---

### 2. Messages lightbox — gray bar, "attachment" caption, low quality, can't exit
**Causes:**
- The lightbox `<Dialog>` in `src/pages/Messages.tsx` is rendered **after** the chat-view early returns (lines 873 / 939). When `chatView === "dm" | "group"`, the early return short-circuits and the Dialog never mounts → tapping an image looks broken / inconsistent with what the user sees on desktop where Dialog default close button + DialogHeader leak a gray strip.
- DM messages render `<p>{msg.content}</p>` with `(attachment)` placeholder unless content is literally `"(attachment)"`. Group messages skip the check entirely → "(attachment)" always shows.
- Inline `<img alt="attachment">` plus a hard-coded `max-h-48` and no `SmartImage` srcset → blurry quality.
- After opening the (broken) lightbox the user gets bounced because the chat view isn't preserving state under the unmounted Dialog.

**Fix — port the Feed lightbox to Messages:**
1. Extract the existing `MediaLightbox` (currently inside `src/components/feed/PostCard.tsx`) into a new shared component `src/components/shared/MediaLightbox.tsx`. Update `PostCard.tsx` to import from the new path (no behavior change).
2. In `Messages.tsx`:
   - Replace the bottom-of-file `<Dialog><ZoomableImage>…` block with the shared `MediaLightbox` mounted inside **both** the DM view and the group view (so it works while the chat is on screen).
   - Track `lightboxIndex` per-message (state `{ messageId, index } | null`) instead of a single URL, so swipe-between-images works the same as Feed.
   - Replace the inline `<img>` in `MessageMedia` with `SmartImage` (`preset="card"`) for crisp 1×/2× rendering; remove the `alt="attachment"` text (use `alt=""` or a generic photo caption).
3. Stop showing the "(attachment)" caption:
   - When sending media-only messages, store `content` as empty string (`""`) instead of `"(attachment)"`. The DB column is nullable text, fine.
   - DM renderer: `{msg.content?.trim() && <p>{msg.content}</p>}`.
   - Group renderer: same guard added (currently missing).
   - Keep a back-compat check that hides legacy `"(attachment)"` strings.

---

### 3. One image at a time in messages
In `handleFileSelect` (and `handleVoiceRecording`) cap image attachments to **1**. If a file is already queued, replace it (or toast "Send the current photo first"). Keep voice notes single-attachment as well. Update the "up to 4 files" toast copy.

Also update the hidden file input: drop `multiple` and tighten `accept` so the picker doesn't suggest multi-select.

---

### 4. Can't exit chat / X closes to home
Root cause is item 2: the lightbox Dialog mounted under `PullToRefreshWrapper` causes Radix to unmount the chat view when it opens/closes (Radix Dialog uses a focus trap + portal that, combined with the chat's own `createPortal`, fights for body focus, and `onOpenChange(false)` from the Dialog re-renders the parent which loses `selectedUser`). Once the lightbox lives **inside** the portaled chat view (item 2 above), back arrow and X behave correctly.

Additionally:
- Wrap the chat-view back-arrow handler in `e.stopPropagation()` and increase the touch hit area to `min-h-[44px] min-w-[44px]` to match the rest of the controls.
- Make the lightbox's `onClose` only call `setLightboxIndex(null)` — never touch `selectedUser` / `chatView`.

---

### 5. Messages double-sending on iOS
**Cause:** `handleSendMessage` guards with `setIsSending(true)`, but the state flip is async and happens **after** an `await supabase.auth.getSession()`. A fast double-tap (or iOS firing both `touchend` and `click`) lets two invocations pass the `disabled={isSending}` check before React re-renders.

**Fix:**
- Add a synchronous `isSendingRef = useRef(false)` guard at the top of `handleSendMessage`; bail immediately if already true; set to true synchronously; reset in a `finally` block.
- Also audit the send button: it currently runs `import("@/lib/haptics").then(...).haptic.medium()` then `handleSendMessage()` synchronously — fine, but wrap in a single `onClick` that doesn't re-fire on bubbled events (`type="button"`).

---

## Files touched
- `src/components/feed/CreatePostForm.tsx` — filter audio/video out of moderation payload.
- `src/components/shared/MediaLightbox.tsx` — **new**, extracted from PostCard.
- `src/components/feed/PostCard.tsx` — import lightbox from new path.
- `src/pages/Messages.tsx` — lightbox swap, one-image cap, `(attachment)` cleanup, send-guard ref, back-button hit area.

No database, RLS, or edge-function changes.

## Out of scope
- Re-styling the Feed lightbox itself (unchanged, just relocated).
- Adding audio/video moderation (today's behavior is text+images only; audio stays unmoderated rather than auto-blocked).
