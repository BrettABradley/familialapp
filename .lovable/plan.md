
## Goal

Fix both scanner findings on the `post-media` bucket without breaking feed posts, albums, fridge pins, campfire responses, or direct-message attachments.

1. **Error — public read:** flip `post-media` to private; only authenticated users who share a circle (or DM thread) with the uploader can read.
2. **Warning — missing UPDATE policy:** add an UPDATE policy on `storage.objects` for `post-media` scoped to the uploader's own folder (mirrors existing DELETE policy).

---

## Strategy

All files in `post-media` are stored under `{uploader_uid}/{filename}`. We gate reads by parsing the first path segment as the uploader and checking that the requester is the uploader, shares a circle with them, or has an existing private-message thread with them. This matches who can see the media in-app today.

Going forward, new uploads store **storage paths** in DB columns (`posts.media_urls`, `fridge_pins.image_url`, `campfire_stories.image_url`, `album_photos.url`, `private_messages.media_urls`). At render time a helper resolves each path to a short-lived signed URL with a small in-memory cache. Legacy rows that still contain full public URLs are detected and the path is extracted (`split('/post-media/')[1]`) so nothing breaks during rollout.

No data backfill is required — the resolver handles both formats. Optionally we can run a one-shot script later to normalize stored values to paths.

---

## Migration (single file)

```sql
-- 1. Bucket private
UPDATE storage.buckets SET public = false WHERE id = 'post-media';

-- 2. Drop the unrestricted public SELECT policy
DROP POLICY IF EXISTS "Public can view post media" ON storage.objects;

-- 3. New gated SELECT policy
CREATE POLICY "post-media authenticated members can read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'post-media'
  AND (
    -- Own folder
    auth.uid()::text = (storage.foldername(name))[1]
    -- Shares a circle with uploader
    OR public.shares_circle_with(auth.uid(), ((storage.foldername(name))[1])::uuid)
    -- Has a DM thread with uploader (either direction)
    OR EXISTS (
      SELECT 1 FROM public.private_messages pm
      WHERE (
        (pm.sender_id = auth.uid()    AND pm.recipient_id = ((storage.foldername(name))[1])::uuid)
        OR (pm.recipient_id = auth.uid() AND pm.sender_id    = ((storage.foldername(name))[1])::uuid)
      )
    )
  )
);

-- 4. UPDATE policy — folder-scoped (fixes the warning)
CREATE POLICY "post-media uploader can update own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);
```

---

## Client helper — `src/lib/postMediaUrl.ts` (new)

```ts
// Resolve a stored value (path OR legacy public URL) to a signed URL.
// In-memory cache; signs for 1 hour, refreshes at ~50 min.
export function toPostMediaPath(value: string): string { ... }
export async function getPostMediaUrl(value: string): Promise<string> { ... }
export async function getPostMediaUrls(values: string[]): Promise<string[]> { ... }
```

Plus a tiny React hook `useSignedMediaUrl(value)` that returns `{ url, loading }` so render components can swap in cleanly.

---

## Files to update

**Uploads** — store path only (no `getPublicUrl`):
- `src/components/feed/CreatePostForm.tsx`
- `src/components/fridge/CampfireDialog.tsx`
- `src/pages/Fridge.tsx`
- `src/pages/Albums.tsx` (cover + photos)
- `src/pages/Messages.tsx` (DM attachments)

**Render sites** — resolve via helper/hook:
- `src/components/feed/PostCard.tsx` (image carousel, video, audio)
- `src/components/shared/ZoomableImage.tsx` (accept resolved URL via parent)
- `src/components/shared/SmartImage.tsx` / `VideoThumbnail.tsx` (accept resolved URL)
- `src/pages/Albums.tsx` (grid + lightbox + zip download — sign each path on the fly)
- `src/pages/Fridge.tsx` (pin image, campfire story image)
- `src/pages/Messages.tsx` (`renderMediaAttachments`)

**Deletes** — paths are already the natural input; just stop the URL-splitting and use the stored path directly:
- `src/components/feed/CreatePostForm.tsx` (remove-on-cancel)
- `src/pages/Albums.tsx` (delete photo, delete album bulk remove)

**Edge functions** — use service role to generate signed URLs (or omit image previews):
- `supabase/functions/admin-dashboard/index.ts` — for moderator review, generate signed URLs server-side.
- `supabase/functions/download-my-data/index.ts` — include signed URLs (longer TTL, e.g. 24h) in export.
- `supabase/functions/send-push-notification/index.ts` and any email previews — skip embedded post-media or sign server-side.

**Legacy compatibility:** the resolver handles full URLs (`https://…/post-media/uid/file.jpg`) by extracting the path, so existing DB rows render correctly after the bucket flips to private.

---

## Rollout

1. Land the migration + client helper + all upload/render swaps in a single PR.
2. Verify against test circle (`ff8b3fee…`) in the demo: feed image post, multi-image carousel, video, audio note, album upload + lightbox + zip download, fridge pin, campfire response, DM image to a friend.
3. Spot-check non-member: confirm they get 400 on a direct storage URL while a member still loads it via signed URL.
4. Re-run the security scanner — both findings should clear.

---

## Out of scope

- Backfilling `media_urls`/`image_url` columns from full URLs to bare paths (resolver handles both; can be done later as a cleanup).
- Avatars, profile-images buckets (separate scanner targets, not in these findings).
- Caching/CDN tuning for signed URLs.
