

# Fix All Outstanding Issues + Enable Multiple Circles

## Overview

This plan addresses all 13 outstanding issues from the audit document, with highest priority on enabling users to create more than one circle. The work is organized into 10 tasks.

---

## Task 1: Enable Multiple Circles (HIGHEST PRIORITY)

**Issue:** Every user is limited to 1 circle because the `can_create_circle()` database function defaults `max_circles` to 1 when no `user_plans` row exists -- and the `user_plans` table is currently empty for all users.

**Changes:**
1. Create a database migration to change the default in `can_create_circle()` from 1 to 3 (or a reasonable free-tier default)
2. Alternatively, auto-insert a `user_plans` row via a trigger on `auth.users` (similar to the existing `handle_new_user` trigger for profiles), setting `max_circles = 3` for all new users
3. Backfill existing users: insert `user_plans` rows for any user who already has a profile but no plan
4. Add a user-friendly error message in `Circles.tsx` when the circle creation fails due to the plan limit, instead of showing the raw database error

**Technical approach:** Update the `can_create_circle` function to default to 3 instead of 1. This is the simplest fix since it requires no trigger changes and immediately applies to all users.

---

## Task 2: Fix `supabase as any` Casts in Circles.tsx and Fridge.tsx

**Issue:** `Circles.tsx` (line 63) and `Fridge.tsx` (lines 81, 104) use `(supabase as any)` to bypass TypeScript mismatches on queries with relationship hints.

**Changes:**
1. Add foreign key constraints via migration:
   - `circle_memberships.user_id -> profiles.user_id`
   - `circle_memberships.circle_id -> circles.id` (verify existing)
   - `fridge_pins.circle_id -> circles.id` (verify existing)
2. Update `types.ts` will auto-regenerate after migration
3. Replace `(supabase as any)` with properly typed `supabase` calls using explicit relationship hints matching the new FK names
4. Remove `as unknown as` casts where the types now align

---

## Task 3: Make Comment Submission Truly Optimistic in Feed.tsx

**Issue:** `handleSubmitComment` only updates UI after the database insert succeeds, unlike `handleReaction` which is truly optimistic.

**Changes:**
- Restructure `handleSubmitComment` to:
  1. Immediately append the comment to local state
  2. Clear the input
  3. Attempt the database insert
  4. On failure, revert the local state and show an error toast

---

## Task 4: Add Realtime Subscriptions to Messages.tsx

**Issue:** Messages page does not use Supabase Realtime. Users must refresh to see new messages.

**Changes:**
1. Create a migration to enable realtime on `private_messages`: `ALTER PUBLICATION supabase_realtime ADD TABLE public.private_messages;`
2. In `Messages.tsx`, add a `useEffect` that subscribes to `postgres_changes` on `private_messages` filtered to the current user
3. On `INSERT` events where the user is the recipient, append the new message to `messages` state and update the conversations list
4. Clean up the subscription on unmount

---

## Task 5: Add Error Handling to `markAllAsRead` in Notifications.tsx

**Issue:** `markAllAsRead` does not check for database errors. If the update fails, the UI still shows all as read.

**Changes:**
- Capture the `error` from the Supabase update call
- Only update local state if no error occurred
- Show a destructive toast on failure

---

## Task 6: Refactor Feed.tsx into Smaller Components

**Issue:** Feed.tsx is 616 lines handling post creation, file upload, reactions, comments, and rendering.

**Changes:**
1. Create `src/hooks/useFeedPosts.ts` -- custom hook containing:
   - `posts` state, `fetchPosts`, `handleReaction`, `handleSubmitComment`
   - All post-related state management
2. Create `src/components/feed/CreatePostForm.tsx` -- post creation form with file upload (current lines 362-466)
3. Create `src/components/feed/PostCard.tsx` -- single post rendering with reactions and comments (current lines 480-609)
4. Create `src/components/feed/PostMediaGrid.tsx` -- media grid within a post (current lines 505-523)
5. Reduce `Feed.tsx` to ~80 lines: imports, hook usage, layout shell

---

## Task 7: Add Storage Cleanup on Photo/Album Deletion

**Issue:** Deleting photos or albums removes database records but leaves orphaned files in the `post-media` storage bucket.

**Changes:**
- In `Albums.tsx` `handleDeletePhoto`: before deleting the DB record, extract the storage path from the `photo_url` and call `supabase.storage.from("post-media").remove([path])`
- In `Albums.tsx` `handleDeleteAlbum`: fetch all photos in the album first, delete their storage files, then delete the album record
- Add the same cleanup to `Feed.tsx` if posts with media are ever deleted (currently posts cannot be deleted from the UI, so this is lower priority)

---

## Task 8: Add Pagination to Feed, Events, and Notifications

**Issue:** All queries use `.limit(50)` with no way to load older content.

**Changes:**
1. **Feed.tsx:** Add a "Load More" button at the bottom. Use cursor-based pagination keyed on `created_at` of the last post. Append older posts to the existing array.
2. **Events.tsx:** Add the same "Load More" pattern.
3. **Notifications.tsx:** Add the same "Load More" pattern.

Each page will track a `hasMore` boolean (set to `false` when fewer than 50 items are returned) and show/hide the button accordingly.

---

## Task 9: Fix `markAsRead` Error Handling in Notifications.tsx

**Issue:** The individual `markAsRead` function (lines 53-69) does optimistic update but the revert path only fires on error. However, `deleteNotification` (lines 87-101) has the same pattern but already has proper error handling. Both are fine per the last audit pass. The remaining gap is `markAllAsRead` (covered in Task 5).

**Status:** Already addressed by Task 5. No additional work needed.

---

## Task 10: Document Known Limitations (No Code Changes)

These items are acknowledged limitations that cannot be resolved purely in code:

- **No native mobile app:** Capacitor integration is a strategic initiative, not a bug fix. The responsive web layout serves mobile users adequately.
- **Family Tree lacks visual tree rendering:** The flat grid is a feature gap requiring a tree visualization library (e.g., react-flow or d3-hierarchy). This is a significant feature addition, not a bug fix.
- **Resend domain verification:** External configuration dependency. Invitation emails work for verified domains only. Cannot be fixed in code.
- **No automated testing:** Adding a test suite is a separate initiative. The existing `vitest` setup is ready but needs test authoring.
- **Store offer review/approval workflow:** No admin dashboard exists. This is a feature gap requiring an admin UI and role-based access.

---

## Implementation Order

```text
1. Task 1  - Enable multiple circles (database migration, highest priority)
2. Task 2  - Fix supabase as any casts (database migration + code)
3. Task 5  - Fix markAllAsRead error handling (quick code fix)
4. Task 3  - Make comments truly optimistic (code refactor)
5. Task 4  - Add Realtime to Messages (migration + code)
6. Task 7  - Add storage cleanup on deletion (code)
7. Task 6  - Refactor Feed.tsx into components (code refactor)
8. Task 8  - Add pagination (code)
```

Tasks 9 and 10 require no code changes.

---

## Summary Table

| # | Category | Issue | Action |
|---|----------|-------|--------|
| 1 | Critical | Users can only create 1 circle | Change default max_circles from 1 to 3 |
| 2 | Bug | `supabase as any` casts | Add FK constraints, fix types |
| 3 | Bug | Comments not truly optimistic | Restructure to optimistic-first |
| 4 | Bug | Messages not realtime | Add Supabase Realtime subscription |
| 5 | Bug | markAllAsRead no error handling | Add error check and toast |
| 6 | Code Quality | Feed.tsx monolith (616 lines) | Extract components and hook |
| 7 | Bug | Orphaned storage files | Delete storage objects on record delete |
| 8 | Feature | No pagination | Add "Load More" to Feed, Events, Notifications |
| 9 | N/A | Already covered by Task 5 | No action |
| 10 | Documentation | Known limitations | Acknowledged, no code fix |

