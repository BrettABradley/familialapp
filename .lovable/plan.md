

# Plan: Allow Circle Admins to Delete Any Post or Comment

## What needs to change

Circle admins (owners + users with the `admin` role) should be able to delete any post or comment within their circle, not just their own content. This requires changes at three layers: database policies, backend logic, and UI visibility.

## Changes

### 1. Database: Update RLS policies

**Posts table** — Update the DELETE policy from `auth.uid() = author_id` to also allow circle admins:
```sql
DROP POLICY "Authors can delete posts" ON posts;
CREATE POLICY "Authors and admins can delete posts" ON posts
  FOR DELETE USING (
    auth.uid() = author_id 
    OR is_circle_admin(auth.uid(), circle_id)
  );
```

**Comments table** — Update the DELETE policy similarly. Since comments reference `post_id` (not `circle_id` directly), the policy needs a subquery:
```sql
DROP POLICY "Authors can delete comments" ON comments;
CREATE POLICY "Authors and admins can delete comments" ON comments
  FOR DELETE USING (
    auth.uid() = author_id 
    OR EXISTS (
      SELECT 1 FROM posts p 
      WHERE p.id = comments.post_id 
      AND is_circle_admin(auth.uid(), p.circle_id)
    )
  );
```

### 2. CircleContext: Expose admin check

Add an `isCircleAdmin` helper to `CircleContext` that checks if the current user is the circle owner or has an admin role in `user_roles`. This avoids querying on every render — the context already has `circles` with `owner_id`, and we can fetch the user's admin roles once.

- Fetch `user_roles` where `role = 'admin'` for the current user on load
- Expose `isCircleAdmin(circleId): boolean` — returns true if user is owner or has admin role

### 3. Feed hook (`useFeedPosts.ts`): Allow admin deletion

- `handleDeletePost`: Remove the `postToDelete.author_id !== user?.id` guard. Instead, allow deletion if the user is the author OR is a circle admin for that post's circle.
- `handleDeleteComment`: Same — remove the `comment.author_id !== user.id` guard when the user is a circle admin.

### 4. Feed page (`Feed.tsx`): Pass admin status

- Pass `isCircleAdmin` status so PostCard receives it and can show delete buttons for admins on all posts/comments.

### 5. PostCard UI: Show delete/trash buttons for admins

- **Post delete button**: Currently gated by `isOwnPost`. Add a new prop `isCircleAdmin` and show the delete button when `isOwnPost || isCircleAdmin`.
- **Comment delete button**: Currently gated by `currentUserId === comment.author_id`. Change to also show when `isCircleAdmin` is true.
- Edit button remains author-only (admins can remove content but not modify others' words).

### Files to modify
- `src/contexts/CircleContext.tsx` — add admin role fetching + `isCircleAdmin` helper
- `src/hooks/useFeedPosts.ts` — relax author-only guards for delete operations
- `src/pages/Feed.tsx` — pass admin status to PostCard
- `src/components/feed/PostCard.tsx` — accept `isCircleAdmin` prop, show delete UI for admins
- Database migration — update DELETE policies on `posts` and `comments` tables

