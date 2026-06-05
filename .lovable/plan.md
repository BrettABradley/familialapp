# Clear the three flagged security findings

Two of the three are **already fixed in code** — the scanner result is stale. The third is a real tightening on the `post-media` storage bucket.

## 1. Google Play RTDN webhook (Critical — already fixed)

`supabase/functions/google-play-rtdn/index.ts` already enforces a `?secret=<GOOGLE_PLAY_RTDN_SECRET>` query-param check at the top of the handler and rejects every request that doesn't match (lines 60–69). The exact mitigation the scanner suggested is in place.

Action: mark the finding as fixed via the security tool. No code change.

## 2. Transactional email endpoint accepts anon JWTs (Critical — already fixed)

`supabase/functions/send-transactional-email/index.ts` already:
- Decodes the caller's JWT and rejects anything other than `role === 'service_role'` with a 403 (lines 40–67).
- Validates `templateData.url` against an allowlist of `*.familialmedia.com` origins and rejects anything else with 400 (lines 34–38, 119–127).

Action: mark the finding as fixed. No code change.

## 3. Post-media bucket read policy — folder-ownership shortcut (Warning — needs a migration)

Current `post-media members can read` SELECT policy starts with:

```sql
((auth.uid())::text = (storage.foldername(name))[1])
```

…then ORs together the row-based checks (posts, fridge_pins, album_photos, campfire_stories, private_messages, group_chat_messages). That first clause means a user permanently retains read access to anything they ever uploaded, even after leaving the circle.

### Fix (single migration)

Drop and recreate `post-media members can read` without the folder-ownership branch — keep every row-based clause exactly as it is today. Access is then strictly tied to current circle membership / current message participation, which is what the scanner expects and matches our intent.

Keep the separate `post-media uploader can update own files` policy (UPDATE) and the existing INSERT/DELETE policies untouched — uploaders still need folder-ownership for write operations.

### Why this is safe for upload flows

`CreatePostForm`, `Albums`, `Fridge`, `Messages`, and `CampfireDialog` all upload first and only sign URLs **after** the corresponding DB row (post, album_photo, fridge_pin, message, campfire_story) is inserted. The row-based branches of the policy already grant SELECT at that point. There's no in-app code path that signs a `post-media` URL before the row exists, so removing the folder shortcut won't break the active app. Server-side signing in `download-my-data`, `admin-dashboard`, and the email helpers uses the service role and bypasses RLS regardless.

### What's NOT changing

- No edge function code edits
- No frontend changes
- Bucket itself, INSERT/UPDATE/DELETE policies, and all row-based SELECT branches stay identical

## Verification

- Open Feed, Albums, Fridge, Messages → existing images still load (row-based branches grant access).
- Re-run the security scan → all three findings should clear.
- Spot-check: a user who leaves a circle can no longer sign URLs for media they uploaded while a member (manual SQL check is easy).
