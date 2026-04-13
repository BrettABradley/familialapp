-- Add is_hidden to posts
ALTER TABLE public.posts ADD COLUMN is_hidden boolean NOT NULL DEFAULT false;

-- Add is_hidden to comments
ALTER TABLE public.comments ADD COLUMN is_hidden boolean NOT NULL DEFAULT false;

-- Update SELECT policies to filter out hidden content for regular users
-- Posts: only show non-hidden posts to circle members
DROP POLICY IF EXISTS "Circle members can view posts" ON public.posts;
CREATE POLICY "Circle members can view posts"
ON public.posts
FOR SELECT
USING (
  (is_hidden = false)
  AND (
    (circle_id IN (SELECT circle_memberships.circle_id FROM circle_memberships WHERE circle_memberships.user_id = auth.uid()))
    OR (circle_id IN (SELECT circles.id FROM circles WHERE circles.owner_id = auth.uid()))
  )
);

-- Comments: only show non-hidden comments
DROP POLICY IF EXISTS "Circle members can view comments" ON public.comments;
CREATE POLICY "Circle members can view comments"
ON public.comments
FOR SELECT
USING (
  (is_hidden = false)
  AND (
    post_id IN (
      SELECT posts.id FROM posts
      WHERE (
        (posts.circle_id IN (SELECT circle_memberships.circle_id FROM circle_memberships WHERE circle_memberships.user_id = auth.uid()))
        OR (posts.circle_id IN (SELECT circles.id FROM circles WHERE circles.owner_id = auth.uid()))
      )
    )
  )
);