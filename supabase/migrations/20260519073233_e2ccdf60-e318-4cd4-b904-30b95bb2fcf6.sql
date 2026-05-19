CREATE OR REPLACE FUNCTION public.notify_on_rsvp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_creator uuid;
  v_circle_id uuid;
  v_title text;
  v_event_date date;
  v_actor_name text;
  v_alias text;
  v_status_text text;
BEGIN
  SELECT created_by, circle_id, title, event_date
    INTO v_creator, v_circle_id, v_title, v_event_date
  FROM events WHERE id = NEW.event_id;

  IF v_creator IS NULL OR v_creator = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Only fire on INSERT, or on UPDATE when status actually changes
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = NEW.user_id;
  SELECT alias INTO v_alias FROM member_aliases
    WHERE user_id = v_creator AND target_user_id = NEW.user_id LIMIT 1;

  v_status_text := CASE NEW.status
    WHEN 'going' THEN 'is going to'
    WHEN 'maybe' THEN 'might attend'
    WHEN 'not_going' THEN 'can''t make it to'
    ELSE 'RSVP''d to'
  END;

  INSERT INTO notifications (user_id, type, title, message, related_circle_id, link)
  VALUES (
    v_creator,
    'event_rsvp',
    'New RSVP',
    COALESCE(v_alias, v_actor_name, 'Someone') || ' ' || v_status_text || ' "' || v_title || '"',
    v_circle_id,
    '/events'
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_event_rsvp ON public.event_rsvps;
CREATE TRIGGER trg_notify_event_rsvp
AFTER INSERT OR UPDATE ON public.event_rsvps
FOR EACH ROW EXECUTE FUNCTION public.notify_on_rsvp();