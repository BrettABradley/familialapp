
-- RSVP: always include circle + eventId so the right circle loads and the event dialog opens.
CREATE OR REPLACE FUNCTION public.notify_on_rsvp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_actor_name text; v_alias text; v_event_title text; v_event_creator uuid; v_circle_id uuid;
BEGIN
  SELECT e.title, e.created_by, e.circle_id INTO v_event_title, v_event_creator, v_circle_id
  FROM events e WHERE e.id = NEW.event_id;
  IF v_event_creator IS NULL OR v_event_creator = NEW.user_id THEN RETURN NEW; END IF;
  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = NEW.user_id;
  SELECT alias INTO v_alias FROM member_aliases WHERE user_id = v_event_creator AND target_user_id = NEW.user_id LIMIT 1;
  INSERT INTO notifications (user_id, type, title, message, related_circle_id, link)
  VALUES (
    v_event_creator,
    'event_rsvp',
    'New RSVP',
    COALESCE(v_alias, v_actor_name, 'Someone') || ' is going to "' || v_event_title || '"',
    v_circle_id,
    '/events?circle=' || v_circle_id::text || '&eventId=' || NEW.event_id::text
  );
  RETURN NEW;
END;
$function$;

-- Circle invite: route to /notifications where Pending Invites is rendered.
CREATE OR REPLACE FUNCTION public.handle_invite_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_user_id uuid;
  circle_name text;
  inviter_name text;
BEGIN
  SELECT au.id INTO target_user_id FROM auth.users au WHERE au.email = NEW.email;
  IF target_user_id IS NOT NULL THEN
    SELECT c.name INTO circle_name FROM public.circles c WHERE c.id = NEW.circle_id;
    SELECT p.display_name INTO inviter_name FROM public.profiles p WHERE p.user_id = NEW.invited_by;
    INSERT INTO public.notifications (user_id, type, title, message, related_circle_id, link)
    VALUES (
      target_user_id,
      'circle_invite',
      'Circle Invitation',
      COALESCE(inviter_name, 'Someone') || ' invited you to "' || COALESCE(circle_name, 'a circle') || '"',
      NEW.circle_id,
      '/notifications'
    );
  END IF;
  RETURN NEW;
END;
$function$;
