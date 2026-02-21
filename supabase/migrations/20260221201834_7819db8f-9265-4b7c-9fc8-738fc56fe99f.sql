
-- Step 1: Clean up existing stale invites where user already joined the circle
UPDATE circle_invites ci
SET status = 'accepted'
WHERE ci.status = 'pending'
AND EXISTS (
  SELECT 1 FROM auth.users au
  JOIN circle_memberships cm ON cm.user_id = au.id
  WHERE au.email = ci.email AND cm.circle_id = ci.circle_id
);

-- Also mark stale invites where user is the circle owner
UPDATE circle_invites ci
SET status = 'accepted'
WHERE ci.status = 'pending'
AND EXISTS (
  SELECT 1 FROM auth.users au
  JOIN circles c ON c.owner_id = au.id
  WHERE au.email = ci.email AND c.id = ci.circle_id
);

-- Step 2: Create validation trigger to prevent future duplicate/unnecessary invites
CREATE OR REPLACE FUNCTION public.validate_circle_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Reject if the invited email belongs to someone already in the circle (as member)
  IF EXISTS (
    SELECT 1 FROM auth.users au
    JOIN circle_memberships cm ON cm.user_id = au.id
    WHERE au.email = NEW.email AND cm.circle_id = NEW.circle_id
  ) THEN
    RAISE EXCEPTION 'User is already a member of this circle';
  END IF;

  -- Reject if the invited email belongs to the circle owner
  IF EXISTS (
    SELECT 1 FROM auth.users au
    JOIN circles c ON c.owner_id = au.id
    WHERE au.email = NEW.email AND c.id = NEW.circle_id
  ) THEN
    RAISE EXCEPTION 'User is already the owner of this circle';
  END IF;

  -- Reject if there's already a pending non-expired invite for same email + circle
  IF EXISTS (
    SELECT 1 FROM circle_invites ci
    WHERE ci.email = NEW.email
      AND ci.circle_id = NEW.circle_id
      AND ci.status = 'pending'
      AND ci.expires_at > now()
  ) THEN
    RAISE EXCEPTION 'A pending invite already exists for this email and circle';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_circle_invite_before_insert
  BEFORE INSERT ON circle_invites
  FOR EACH ROW
  EXECUTE FUNCTION validate_circle_invite();
