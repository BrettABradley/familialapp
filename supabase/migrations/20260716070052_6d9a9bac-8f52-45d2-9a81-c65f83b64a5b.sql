-- Tighten photo_albums UPDATE so non-creator/non-admin circle members can
-- only change cover_photo_url, not name/description/other album fields.
--
-- We keep the "Circle members can update album cover" policy (so members
-- can still change the cover), and enforce the column restriction with a
-- BEFORE UPDATE trigger — same pattern as restrict_circle_member_update
-- on circles.

CREATE OR REPLACE FUNCTION public.restrict_photo_album_member_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service role (auth.uid() is NULL)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Creator or circle admin: allow all changes
  IF OLD.created_by = auth.uid()
     OR public.is_circle_admin(auth.uid(), OLD.circle_id) THEN
    RETURN NEW;
  END IF;

  -- Non-creator, non-admin circle members: only cover_photo_url may change
  IF NEW.name IS DISTINCT FROM OLD.name
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.circle_id IS DISTINCT FROM OLD.circle_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
  THEN
    RAISE EXCEPTION 'Only the album creator or a circle admin can change album details other than the cover photo';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restrict_photo_album_member_update_trg ON public.photo_albums;

CREATE TRIGGER restrict_photo_album_member_update_trg
  BEFORE UPDATE ON public.photo_albums
  FOR EACH ROW
  EXECUTE FUNCTION public.restrict_photo_album_member_update();