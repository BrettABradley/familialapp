
CREATE OR REPLACE FUNCTION public.notify_on_event_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_name text;
  v_member record;
BEGIN
  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = NEW.created_by;

  FOR v_member IN
    SELECT cm.user_id FROM circle_memberships cm WHERE cm.circle_id = NEW.circle_id AND cm.user_id <> NEW.created_by
    UNION
    SELECT c.owner_id FROM circles c WHERE c.id = NEW.circle_id AND c.owner_id <> NEW.created_by
  LOOP
    INSERT INTO notifications (user_id, type, title, message, related_circle_id, link)
    VALUES (
      v_member.user_id,
      'event_created',
      'New Event',
      COALESCE(v_actor_name, 'Someone') || ' added "' || NEW.title || '" — RSVP now!',
      NEW.circle_id,
      '/events?eventId=' || NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$function$;
