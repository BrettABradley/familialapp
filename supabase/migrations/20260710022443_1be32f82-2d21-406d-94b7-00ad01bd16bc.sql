
-- posts
DROP POLICY IF EXISTS "Authors can update posts" ON public.posts;
CREATE POLICY "Authors can update posts"
  ON public.posts FOR UPDATE TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (
    auth.uid() = author_id
    AND public.is_circle_member(auth.uid(), circle_id)
  );

-- events
DROP POLICY IF EXISTS "Event creators can update events" ON public.events;
CREATE POLICY "Event creators can update events"
  ON public.events FOR UPDATE TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (
    auth.uid() = created_by
    AND public.is_circle_member(auth.uid(), circle_id)
  );

-- family_tree_members
DROP POLICY IF EXISTS "Circle admins can update family tree" ON public.family_tree_members;
CREATE POLICY "Circle admins can update family tree"
  ON public.family_tree_members FOR UPDATE TO authenticated
  USING (public.is_circle_admin(auth.uid(), circle_id))
  WITH CHECK (public.is_circle_admin(auth.uid(), circle_id));

-- photo_albums
DROP POLICY IF EXISTS "Album creators can update" ON public.photo_albums;
CREATE POLICY "Album creators can update"
  ON public.photo_albums FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.is_circle_admin(auth.uid(), circle_id))
  WITH CHECK (
    (auth.uid() = created_by OR public.is_circle_admin(auth.uid(), circle_id))
    AND public.is_circle_member(auth.uid(), circle_id)
  );

DROP POLICY IF EXISTS "Circle members can update album cover" ON public.photo_albums;
CREATE POLICY "Circle members can update album cover"
  ON public.photo_albums FOR UPDATE TO authenticated
  USING (public.is_circle_member(auth.uid(), circle_id))
  WITH CHECK (public.is_circle_member(auth.uid(), circle_id));
