
-- Add audio_url column
ALTER TABLE public.campfire_stories ADD COLUMN audio_url text;

-- Make content nullable
ALTER TABLE public.campfire_stories ALTER COLUMN content DROP NOT NULL;

-- Add check constraint: at least one of content or audio_url must be present
ALTER TABLE public.campfire_stories ADD CONSTRAINT story_has_content
  CHECK (content IS NOT NULL OR audio_url IS NOT NULL);

-- Update validation trigger to allow null content
CREATE OR REPLACE FUNCTION public.validate_campfire_story()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.content IS NOT NULL AND length(NEW.content) > 500 THEN
    RAISE EXCEPTION 'Campfire story must be 500 characters or less';
  END IF;
  RETURN NEW;
END;
$function$;
