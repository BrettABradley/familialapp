
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_reminder boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.notify_on_event_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_actor_name text; v_alias text; v_member record; v_circle_name text; v_suffix text;
BEGIN
  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = NEW.created_by;
  SELECT name INTO v_circle_name FROM circles WHERE id = NEW.circle_id;
  v_suffix := CASE WHEN COALESCE(NEW.is_reminder, false) THEN '' ELSE ' — RSVP now!' END;
  FOR v_member IN
    SELECT cm.user_id FROM circle_memberships cm WHERE cm.circle_id = NEW.circle_id AND cm.user_id <> NEW.created_by
    UNION SELECT c.owner_id FROM circles c WHERE c.id = NEW.circle_id AND c.owner_id <> NEW.created_by
  LOOP
    SELECT alias INTO v_alias FROM member_aliases WHERE user_id = v_member.user_id AND target_user_id = NEW.created_by LIMIT 1;
    INSERT INTO notifications (user_id, type, title, message, related_circle_id, link)
    VALUES (v_member.user_id,
      CASE WHEN COALESCE(NEW.is_reminder, false) THEN 'event_reminder' ELSE 'event_created' END,
      CASE WHEN COALESCE(NEW.is_reminder, false) THEN 'New Reminder' ELSE 'New Event' END,
      COALESCE(v_alias, v_actor_name, 'Someone') || ' added "' || NEW.title || '" in ' || COALESCE(v_circle_name, 'your circle') || v_suffix,
      NEW.circle_id, '/events?circle=' || NEW.circle_id::text || '&eventId=' || NEW.id::text);
  END LOOP;
  RETURN NEW;
END;
$function$;
