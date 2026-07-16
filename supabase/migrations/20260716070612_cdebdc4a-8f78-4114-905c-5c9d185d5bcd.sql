
-- 1) circle_memberships: prevent admins from mutating user_id / circle_id via UPDATE
CREATE OR REPLACE FUNCTION public.restrict_circle_membership_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role bypass
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Immutable identifying columns on an existing membership row
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.circle_id IS DISTINCT FROM OLD.circle_id THEN
    RAISE EXCEPTION 'Cannot change user_id or circle_id of an existing membership; remove and re-add instead';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_circle_membership_update ON public.circle_memberships;
CREATE TRIGGER trg_restrict_circle_membership_update
BEFORE UPDATE ON public.circle_memberships
FOR EACH ROW EXECUTE FUNCTION public.restrict_circle_membership_update();

-- Also add a WITH CHECK to the admin update policy for defense in depth
DROP POLICY IF EXISTS "Circle admins can update member roles" ON public.circle_memberships;
CREATE POLICY "Circle admins can update member roles"
ON public.circle_memberships
FOR UPDATE
USING (is_circle_admin(auth.uid(), circle_id))
WITH CHECK (is_circle_admin(auth.uid(), circle_id));

-- 2) photo_albums: drop the overly broad "Circle members can update album cover" policy.
-- The restrict_photo_album_member_update() trigger already enforces that non-creator,
-- non-admin members can only change cover_photo_url, and the "Album creators can update"
-- policy already permits circle members to run the UPDATE (checked by that trigger).
-- But we still need a policy that allows non-creator members to UPDATE at all for the
-- cover column, since the creator policy restricts to creator/admin. Replace with a
-- scoped policy that only allows the row to remain owned/named as it was — the trigger
-- enforces column-level restriction.
DROP POLICY IF EXISTS "Circle members can update album cover" ON public.photo_albums;
CREATE POLICY "Circle members can update album cover"
ON public.photo_albums
FOR UPDATE
USING (
  is_circle_member(auth.uid(), circle_id)
  AND auth.uid() <> created_by
  AND NOT is_circle_admin(auth.uid(), circle_id)
)
WITH CHECK (
  is_circle_member(auth.uid(), circle_id)
);
