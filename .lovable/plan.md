# Finish `post-media` Private Lockdown

Goal: complete the migration started in the previous PR so `post-media` can flip to private with zero broken images across Feed, Fridge, Campfire, Albums, Messages, admin tools, and data export.

The signed-URL helper (`src/lib/postMediaUrl.ts`) and the Feed path (`CreatePostForm` + `PostCard`) already use the new pattern. This plan covers everything still on `getPublicUrl`, then flips the bucket.

---

## 1. Upload + render swaps (mirror Feed pattern)

For each site: **upload** stores the bare storage path (no `getPublicUrl`); **render** resolves via `useSignedMediaUrl` / `useSignedMediaUrls`; **delete** uses the stored path directly (drop URL-splitting).

- **`src/pages/Fridge.tsx`** — pin image upload + grid/lightbox render + delete.
- **`src/components/fridge/CampfireDialog.tsx`** — story image upload + render in dialog and pin detail view.
- **`src/pages/Albums.tsx`** — album cover, photo upload, grid thumbnails, lightbox, ZIP download (sign each path on the fly), bulk delete.
- **`src/pages/Messages.tsx`** — DM attachment upload + `renderMediaAttachments` for images/videos/audio.

Shared touch-ups:
- `src/components/shared/ZoomableImage.tsx`, `SmartImage.tsx`, `VideoThumbnail.tsx` — accept an already-resolved URL from the parent (no helper calls inside; keeps them generic and avoids double signing).

Legacy DB rows with full public URLs continue to render because `toPostMediaPath()` extracts the path from `…/post-media/<path>` URLs. No backfill needed.

## 2. Edge functions — sign server-side with service role

- **`supabase/functions/admin-dashboard/index.ts`** — when returning reported posts/pins/albums/messages for moderator review, call `admin.storage.from('post-media').createSignedUrl(path, 60*60)` for each media reference before returning.
- **`supabase/functions/download-my-data/index.ts`** — for `posts`, `fridge_pins`, `private_messages` (and any other rows with media), replace stored values with 24h signed URLs in the export JSON so the user can actually download their media.
- **`supabase/functions/send-push-notification/index.ts`** — APNs payload doesn't embed media today (only `title`/`body`/`link`), so no change needed. Verify no email preview template pulls a raw `post-media` URL; if any do (e.g., `mention-notification`, `new-album`, `unseen-message`), sign with service role before passing into the template payload.

Shared helper: add a small `signPostMediaPath(admin, value, ttl)` in `supabase/functions/_shared/` that mirrors `toPostMediaPath` + `createSignedUrl` so the three functions share one implementation.

## 3. Re-apply the private-bucket migration

Single migration:

```sql
-- Flip private
UPDATE storage.buckets SET public = false WHERE id = 'post-media';

-- Drop the unrestricted public SELECT
DROP POLICY IF EXISTS "Public can view post media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view post media" ON storage.objects;

-- Gated SELECT: own folder, shared circle, or DM thread with uploader
CREATE POLICY "post-media members can read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'post-media'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.shares_circle_with(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR EXISTS (
      SELECT 1 FROM public.private_messages pm
      WHERE (pm.sender_id = auth.uid() AND pm.recipient_id = ((storage.foldername(name))[1])::uuid)
         OR (pm.recipient_id = auth.uid() AND pm.sender_id = ((storage.foldername(name))[1])::uuid)
    )
  )
);
```

(The folder-scoped UPDATE policy from the previous PR stays in place.)

## 4. QA checklist (test circle `ff8b3fee…`)

- Feed: single image, multi-image carousel, video, audio note — own + other member's posts.
- Fridge: pin with image renders; tap to enlarge.
- Campfire: story image renders in dialog + pin detail.
- Albums: grid thumbs, lightbox swipe, ZIP download contains real bytes.
- Messages: image/video/audio attachments render both directions of a DM.
- Admin dashboard: reported media renders for moderator.
- Download My Data: JSON contains working signed URLs; user can fetch each.
- Negative check: signed-out user and non-member get 400 on a direct storage URL.
- Re-run security scanner → both `post-media` findings clear.

## 5. Rollout order (single PR)

1. Land client swaps (section 1) while bucket is still public — zero user impact, just changes what gets stored going forward and how renders resolve.
2. Land edge function changes (section 2).
3. Land the migration (section 3) **last**, after manual smoke test against staging/demo.
4. If anything regresses post-flip, revert only the migration — client + edge code remain forward-compatible with both public and private buckets.

## Out of scope

- Backfilling existing DB rows from full URLs to bare paths (resolver handles both; optional cleanup later).
- `avatars` / `profile-images` buckets.
- CDN/caching tuning for signed URLs.
