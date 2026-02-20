
-- Add validation trigger for album_photos caption
CREATE OR REPLACE FUNCTION public.validate_album_photo()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.caption IS NOT NULL AND length(NEW.caption) > 500 THEN
    RAISE EXCEPTION 'Album photo caption must be 500 characters or less';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_album_photo_trigger
  BEFORE INSERT OR UPDATE ON public.album_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_album_photo();
