## Problems

1. **Discard button overlaps text in the composer.** When you type a long post, the text wraps right under the red "Discard" button. The button is absolutely positioned inside the textarea wrapper (`absolute bottom-2 right-2`), so wrapped text sits behind it.
2. **Share / "Post" button drops below the keyboard.** The composer card sits in the scrollable feed, so when the iOS/Android keyboard opens the Share button ends up below the visible area and the user has to dismiss the keyboard to find it.
3. **Videos don't show up on the feed (mobile).** On native iOS/Android, "Add Media" calls Capacitor's `pickImage`, which only returns photos. There is no video path at all on native — so any "video" picked from a phone is silently dropped or never reaches the composer. (Web works because the hidden `<input accept="image/*,video/*">` is used.)

## Fix Plan

All changes are frontend-only. **A new iOS + Android build will be required** because `src/components/feed/CreatePostForm.tsx` and `src/lib/imagePicker.ts` are bundled into the native apps.

### 1. `src/components/feed/CreatePostForm.tsx` — Discard button

- Remove the absolutely-positioned Discard button overlay.
- Render Discard as a normal inline control in the header row (right side, next to the circle selector) or as a small right-aligned button immediately **above** the textarea. It only appears when there is text or attached media (same condition as today).
- Drop the `pb-10` reserved padding on the textarea since nothing overlays it anymore.

Result: typed text never collides with Discard; behavior is identical.

### 2. `src/components/feed/CreatePostForm.tsx` — Share visible above keyboard

- On `MentionInput` focus, scroll the Share button into view: `shareButtonRef.current?.scrollIntoView({ block: "end", behavior: "smooth" })` after a short timeout (let the WebView resize first).
- Add `scroll-margin-bottom: 96px` (via Tailwind `scroll-mb-24`) to the Share button container so the scroll lands above the bottom nav / keyboard accessory.
- Keep the existing global `resize: body` keyboard behavior — no native config changes.

Result: keyboard opens → composer auto-scrolls so Share stays visible.

### 3. `src/lib/imagePicker.ts` + `CreatePostForm.openMediaPicker` — Allow video uploads on native

- Add a new helper `pickMedia()` (or extend `pickImage`) that, on native, presents an action sheet: **Take Photo · Choose Photo · Choose Video**. The Video option uses a hidden `<input type="file" accept="video/*">` (iOS/Android WebView both support the native picker through `<input type=file>`), avoiding the Capacitor Camera plugin's image-only limitation.
- Alternative (simpler) implementation: on native, always use the hidden `<input accept="image/*,video/*">` flow that the web build already uses. We lose the native Camera/Library prompt but instantly gain video support.
- Recommendation: ship the simpler `<input>` flow now (unblocks video same release), and revisit the action-sheet UX after.

Result: users on iOS/Android can attach a video; it then flows through the existing upload/feed/`PostCard` video rendering, which already supports `mp4` / `mov`.

### Verification

- Type a long post in the composer on mobile preview — Discard no longer overlaps text.
- Focus the textarea — Share button scrolls into view above the keyboard.
- Pick a `.mov` / `.mp4` from the iOS/Android photo library — preview shows, post creates, video plays inline in the feed (`PostCard` already handles it).
- Confirm web behavior is unchanged.

### Deployment

Yes — you need to push a new iOS and Android build (`bash scripts/pull-updates.sh` → `npx cap sync ios --legacy-peer-deps` / `android` → archive + upload). The server-side feed/storage code is unchanged.
