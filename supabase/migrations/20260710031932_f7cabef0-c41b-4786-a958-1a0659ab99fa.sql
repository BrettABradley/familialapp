
CREATE OR REPLACE FUNCTION public.enforce_album_member_cover_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role / server-side: allow
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Creator or circle admin: full edit rights
  IF NEW.created_by = auth.uid() OR public.is_circle_admin(auth.uid(), NEW.circle_id) THEN
    RETURN NEW;
  END IF;

  -- Other circle members: only cover_photo_url may change
  IF NEW.name IS DISTINCT FROM OLD.name
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.circle_id IS DISTINCT FROM OLD.circle_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
  THEN
    RAISE EXCEPTION 'Only the album creator or a circle admin can edit album details';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_album_member_cover_only_trg ON public.photo_albums;
CREATE TRIGGER enforce_album_member_cover_only_trg
BEFORE UPDATE ON public.photo_albums
FOR EACH ROW EXECUTE FUNCTION public.enforce_album_member_cover_only();
