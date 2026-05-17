# Fix multi-image selection on mobile web

## What's happening

Everything from the previous build (pinch zoom, 5-image carousel, raised 5-file cap) is already in the web codebase — there's only one React app shared by web, mobile web, and the iOS native shell. Publishing pushed it to `familialmedia.com`.

The "can't select multiple images" bug is a separate, real issue specific to iOS Safari's file picker:

The post composer's file input is:

```html
<input type="file" accept="image/*,video/*,audio/*,.heic,.heif" multiple />
```

When iOS Safari sees `audio/*` plus explicit extensions (`.heic`, `.heif`) in `accept`, it routes the tap to the generic **Files** picker instead of the **Photo Library** picker — and Files only allows one selection at a time. That's why `multiple` is being silently ignored on the phone.

## The fix

Two small changes in `src/components/feed/CreatePostForm.tsx`:

1. **Slim the accept attribute** to `"image/*,video/*"`.
   - `image/*` already covers HEIC/HEIF on iOS natively, so the explicit `.heic,.heif` extensions are redundant and trigger the Files-picker fallback.
   - Audio attachments are handled by the in-app VoiceRecorder, not the file picker, so `audio/*` doesn't need to be there.
2. **Optional belt-and-suspenders**: also set the `multiple` attribute explicitly as `multiple={true}` in JSX and confirm there's no `capture` attribute (there isn't, but worth a sanity check during the edit).

Result: tapping "Add Media" on iOS Safari (and Android Chrome) opens the Photo Library with multi-select enabled, exactly like Instagram. Web/desktop behavior is unchanged.

## Verification

After the change is published, on iPhone Safari:
- Open Feed → "Add Media" → multi-select up to 5 photos → they all appear in the new swipeable preview → Share creates one post with the carousel.

## Files

- `src/components/feed/CreatePostForm.tsx` — one-line accept change.

No other files, no DB, no edge functions, no rebuild needed for iOS (this is a web-only Safari quirk; the native iOS app uses a different path).

Ready to apply.
