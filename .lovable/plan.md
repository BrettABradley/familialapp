

## Make Content Moderation Invisible to Users

The goal is to run moderation completely in the background so users never see "Checking content..." or feel any friction. The post will appear to go through normally -- and only if content is flagged will they get a notification.

### Approach: Silent Background Moderation

Instead of blocking the post while moderation runs, we flip the flow:

1. **Post publishes immediately** -- the user sees "Uploading..." then "Posted!" as normal, no mention of content checking
2. **Moderation runs in the background** after the post is inserted into the database
3. **If flagged**, the post is automatically deleted from the database and storage, and the user gets a toast saying it was removed for violating guidelines
4. **If allowed**, nothing happens -- the post stays up seamlessly

This means zero disruption to the normal posting experience.

### Changes

**`src/components/feed/CreatePostForm.tsx`**
- Remove the `moderationStatus` state entirely
- Remove the "Checking content..." button text -- button just shows "Uploading..." then "Share"
- Move the moderation call to **after** the post is inserted into the DB
- Run it with a fire-and-forget async call (no `await` blocking the UI)
- If moderation denies the post: delete the post row from the DB, delete media from storage, and show a toast
- The user flow becomes: click Share -> upload media -> insert post -> show "Posted!" -> moderation quietly runs behind the scenes

**`src/pages/ProfileView.tsx`**
- Same pattern: upload the image, insert the DB row, show success -- then run moderation silently
- If flagged, delete the image row and storage file, and show a toast

### What the User Experiences

| Scenario | What happens |
|---|---|
| Normal content | Post appears instantly, no extra wait, no "checking" message |
| Flagged content | Post appears briefly (1-2 seconds), then disappears with a toast: "This post was removed because it may violate our community guidelines." |

### Technical Details

- The moderation function call is wrapped in a standalone async function that runs without blocking the main flow
- On denial, it calls `supabase.from("posts").delete().eq("id", postId)` to remove the post
- The `onPostCreated()` callback still fires immediately so the feed refreshes, and if the post gets removed, the next refresh will reflect that
- No new dependencies or edge function changes needed -- only the frontend timing changes

