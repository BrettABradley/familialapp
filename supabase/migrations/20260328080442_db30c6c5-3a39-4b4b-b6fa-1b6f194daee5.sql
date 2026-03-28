CREATE OR REPLACE FUNCTION public.restrict_circle_member_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow service role (server-side) operations (auth.uid() is NULL)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- If the circle is on transfer block, allow the claim update
  IF OLD.transfer_block = true THEN
    RETURN NEW;
  END IF;

  -- If the user is the owner, allow all changes
  IF OLD.owner_id = auth.uid() THEN
    RETURN NEW;
  END IF;

  -- Non-owners can only change avatar_url
  IF NEW.name IS DISTINCT FROM OLD.name
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.invite_code IS DISTINCT FROM OLD.invite_code
     OR NEW.transfer_block IS DISTINCT FROM OLD.transfer_block
     OR NEW.extra_members IS DISTINCT FROM OLD.extra_members
  THEN
    RAISE EXCEPTION 'Only the circle owner can modify circle details other than the avatar';
  END IF;

  RETURN NEW;
END;
$function$;