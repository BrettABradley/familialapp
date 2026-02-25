
-- Update posts DELETE policy to allow circle admins
DROP POLICY "Authors can delete posts" ON posts;
CREATE POLICY "Authors and admins can delete posts" ON posts
  FOR DELETE TO authenticated USING (
    auth.uid() = author_id 
    OR is_circle_admin(auth.uid(), circle_id)
  );

-- Update comments DELETE policy to allow circle admins
DROP POLICY "Authors can delete comments" ON comments;
CREATE POLICY "Authors and admins can delete comments" ON comments
  FOR DELETE TO authenticated USING (
    auth.uid() = author_id 
    OR EXISTS (
      SELECT 1 FROM posts p 
      WHERE p.id = comments.post_id 
      AND is_circle_admin(auth.uid(), p.circle_id)
    )
  );
