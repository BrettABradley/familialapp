# Fix: videos/audio render as broken images after signed-URL switch

## Root cause

`getMediaType()` in `src/lib/mediaUtils.ts`:

```ts
const ext = url.split('.').pop()?.toLowerCase().split('?')[0];
```

Signed Supabase URLs end with `?token=<JWT>`, and JWTs always contain two `.` separators (`header.payload.signature`). `split('.').pop()` returns the trailing chunk of the JWT signature, not `mov`/`mp3`/`m4a`, so the function falls through to `'image'`. Every video and audio attachment on the now-private `post-media` bucket is therefore handed to an `<img>` tag → broken-image icon with alt text (the `.mov` in the screenshot).

This only became visible after the bucket flip because public URLs had no `?token=` suffix.

## Fix (1 file, frontend-only)

Edit `src/lib/mediaUtils.ts` → `getMediaType()`: strip the query string **before** taking the extension.

```ts
const clean = url.split('?')[0].split('#')[0];
const ext = clean.split('.').pop()?.toLowerCase();
```

Everything else (mp3/wav/ogg/m4a/aac/flac → audio, mp4/mov/webm/avi/mkv → video, voice-note name heuristic, heic/heif → image) is unchanged.

## Why this also fixes audio

The audio branch in `PostCard.MediaItem` already renders `<audio controls>` when `getMediaType === 'audio'`. With the extension parsed correctly, `.m4a`/`.mp3`/`.wav` voice notes and clips will hit that branch and show the native player instead of the broken-image fallback.

## Verification

- Reload the post in the screenshot → the first tile renders as `VideoThumbnail` (canvas-captured first frame + play overlay) instead of a broken `<img>`.
- Open a circle with a voice-note post → native `<audio>` player appears.
- Single-video post and multi-media carousels both classify correctly.
- No backend, RLS, or migration changes; no other components touched.
