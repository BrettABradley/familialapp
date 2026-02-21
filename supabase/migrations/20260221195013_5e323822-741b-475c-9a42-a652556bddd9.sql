
-- 1. Trigger function: when an invite is created, if the email belongs to an existing user, create a notification
CREATE OR REPLACE FUNCTION public.handle_invite_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_user_id uuid;
  circle_name text;
  inviter_name text;
BEGIN
  -- Check if the invited email belongs to an existing user
  SELECT au.id INTO target_user_id
  FROM auth.users au
  WHERE au.email = NEW.email;

  -- Only notify existing users (new signups are auto-joined via the other trigger)
  IF target_user_id IS NOT NULL THEN
    -- Get circle name
    SELECT c.name INTO circle_name
    FROM public.circles c WHERE c.id = NEW.circle_id;

    -- Get inviter display name
    SELECT p.display_name INTO inviter_name
    FROM public.profiles p WHERE p.user_id = NEW.invited_by;

    -- Create notification for the invited user
    INSERT INTO public.notifications (user_id, type, title, message, related_circle_id)
    VALUES (
      target_user_id,
      'circle_invite',
      'Circle Invitation',
      COALESCE(inviter_name, 'Someone') || ' invited you to join "' || COALESCE(circle_name, 'a circle') || '"',
      NEW.circle_id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Attach trigger to circle_invites
CREATE TRIGGER on_circle_invite_created
  AFTER INSERT ON public.circle_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_invite_notification();

-- 3. Allow invited users to also SELECT invites where status is pending (even expired check)
-- Already have "Invited users can view their pending invites" policy, but let's also
-- allow users to decline invites by updating status to 'declined'
-- The existing UPDATE policy already covers this since it checks email match + pending status
