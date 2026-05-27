## 1. Tap-to-undo button doesn't work

**Root cause:** `useFeedPosts.handleDeletePost` shows a toast with the copy "Tap to undo within 10 seconds" but never attaches an actual `action`. The undo handler is stashed on `window.__lastDeleteUndo`, which nothing in the UI calls. Tapping the toast does nothing.

**Fix:** Attach a real `ToastAction` to the delete toast so tapping it invokes the restore logic.

- In `src/hooks/useFeedPosts.ts`, replace the window stash with a local `undoHandler` and pass it to the toast via `action: <ToastAction altText="Undo" onClick={undoHandler}>Undo</ToastAction>`.
- The undo handler clears the timeout, sets `deleted_at = null`, re-inserts `postToDelete` into local state (sorted), and shows a "Post restored" toast.
- Add the missing `ToastAction` import (already used elsewhere).

## 2. Audio post never finishes loading / no playback

**Root cause:** Both `PostCard` (feed) and `Messages` render voice notes with `<audio controls><source src={url} /></audio>`. On iOS Safari/WKWebView:

- `<source>` is parsed once at mount. When `useSignedMediaUrl` resolves and the parent re-renders with the real URL, the `<source>` child does not trigger a reload, so the player sits in "loading" forever.
- `<source>` without an explicit `type` makes iOS refuse to pick a codec for signed Supabase URLs (the `?token=...` JWT hides the `.m4a` extension from the sniffer).

**Fix:** Switch to direct `<audio src={url} preload="metadata">` and pass an explicit `type` derived from the storage path extension (not from the signed URL). Add `playsInline` and a `key={url}` so the element fully remounts when the signed URL arrives.

- Create a tiny shared component `src/components/shared/VoiceNotePlayer.tsx` that:
  - Takes a stored path (or already-resolved URL).
  - Uses `useSignedMediaUrl` to resolve.
  - Derives `mimeType` from the original path extension (`m4a`→`audio/mp4`, `mp3`→`audio/mpeg`, `webm`→`audio/webm`, `ogg`→`audio/ogg`, `wav`→`audio/wav`, `aac`→`audio/aac`, default `audio/mp4`).
  - Renders `<audio key={url} src={url} controls preload="metadata" playsInline />` inside the existing `bg-secondary` pill.
  - Shows a small skeleton while `loading || !url`.
- Replace the two `<audio><source/></audio>` blocks in `src/components/feed/PostCard.tsx` (lines ~192–199 single audio, ~274–279 carousel) with `<VoiceNotePlayer storedPath={originalUrl} />`.
- Replace the inline `<audio key={i} src={url} controls ... />` in `src/pages/Messages.tsx` (line ~125) with `<VoiceNotePlayer storedPath={originalUrl} className="max-w-[240px]" />`.
- No changes to upload/recording code; `blobToVoiceNoteFile` + the `voice-note-` filename already produce consistent containers.

## 3. Carousel indicator on personal-profile preview

The `Layers` icon + count badge already exists in `src/pages/ProfileView.tsx` (lines 672–677) but the user reports it's not visible. Tighten it to match the user's spec ("super small in top right"):

- Keep the existing `count > 1` condition.
- Shrink to a pure icon (no number), size `h-3.5 w-3.5`, white, with a soft black drop-shadow instead of a pill background, positioned `absolute top-1 right-1`.
- Hide it inside the lightbox (it already lives only on the grid button, so no change needed there).

No changes to backend, RLS, edge functions, or migrations. No new dependencies.

## Verification

- Delete a feed post → toast shows an "Undo" button → tap it → post reappears.
- Record + post a voice note on iOS → audio pill loads, scrubber shows duration, playback works.
- Same in DMs/group chats.
- Open a profile with a multi-image post → small layered icon visible in top-right of the thumbnail; single-item posts show no icon.
