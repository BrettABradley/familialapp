# Fix: signed post-media URLs render as broken images everywhere

## Root cause

After the private-bucket lockdown, media values resolve to signed URLs:
`https://<ref>.supabase.co/storage/v1/object/sign/post-media/<path>?token=<jwt>`

`src/lib/imageUrl.ts` → `transformedImage()` matches both `object/public/` and `object/sign/` and rewrites the path to `/storage/v1/render/image/<...>`, then appends `&width=…&quality=…&resize=…`.

Supabase's render endpoint does **not** accept a token that was signed for the plain `object/sign` path — transformed signed URLs must be requested up-front via `createSignedUrl(path, ttl, { transform: {...} })`. Result: every `<img>` from `post-media` 404s and shows the broken-image icon (the exact UI in the screenshot). Video tiles render the play overlay because they don't go through `presetImage`.

This affects: Feed (`PostCard`, single + carousel + lightbox preload), Albums grid + covers, Fridge pins, Profile headers, Messages thumbnails, Campfire artwork — every call site that pipes a signed URL through `presetImage`, `transformedImage`, `srcSetFor`, or `avatarUrl`.

## Fix (surgical, frontend-only, no security regression)

Edit `src/lib/imageUrl.ts`:

1. `transformedImage()` — when the URL is a signed Storage URL (`/storage/v1/object/sign/`), **return it unchanged** instead of rewriting to the render endpoint. Public-bucket URLs (avatars, profile-images) keep getting the optimized render path.
2. `srcSetFor()` — when the URL is signed, return `""` so the `<img>` falls back to `src` only (no broken 2x candidate).
3. Leave `presetImage()` and `avatarUrl()` as-is; they call the two functions above and will inherit the correct behavior.

That's it. No component changes, no migration, no RLS change. Signed URLs are served at their native resolution (still CDN-cached by Supabase), public-bucket images keep their WebP/resize optimization.

## Trade-off the user should know

Until we move to up-front transformed signed URLs, post/fridge/album/DM images download at original resolution (no on-the-fly resize/WebP). Acceptable to ship now to unblock the platform; follow-up can swap `getPostMediaUrl()` to call `createSignedUrl(path, ttl, { transform: { width, quality, resize } })` with per-preset variants and cache them separately, then re-enable transforms for signed URLs in `imageUrl.ts`.

## Verification

- Reload feed → images render (no broken-icon placeholders).
- Confirm Fridge pins, Album covers/photos, Profile headers, DM attachments also render.
- Network tab: image requests hit `/storage/v1/object/sign/post-media/...` and return 200; no `/render/image/sign/...` 400s.
- Avatars (public `avatars` bucket) still go through `/render/image/public/avatars/...` — optimization preserved.
