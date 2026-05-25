
-- 1) Faster queue dispatch
UPDATE public.email_send_state SET send_delay_ms = 50 WHERE id = 1;

-- 2) Mention notifications: include circle name and deep link
CREATE OR REPLACE FUNCTION public.create_mention_notifications(_mentioned_user_ids uuid[], _post_id uuid, _circle_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_actor_name text; v_alias text; v_uid uuid; v_circle_name text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = auth.uid();
  SELECT name INTO v_circle_name FROM circles WHERE id = _circle_id;
  FOREACH v_uid IN ARRAY _mentioned_user_ids LOOP
    IF v_uid <> auth.uid() THEN
      SELECT alias INTO v_alias FROM member_aliases WHERE user_id = v_uid AND target_user_id = auth.uid() LIMIT 1;
      INSERT INTO notifications (user_id, type, title, message, related_post_id, related_user_id, related_circle_id, link)
      VALUES (v_uid, 'mention', 'You were mentioned',
        COALESCE(v_alias, v_actor_name, 'Someone') || ' mentioned you in ' || COALESCE('"' || v_circle_name || '"', 'a post'),
        _post_id, auth.uid(), _circle_id,
        '/feed?circle=' || _circle_id::text || '&post=' || _post_id::text);
    END IF;
  END LOOP;
END;
$function$;

-- 3) DM notifications: deep-link to specific thread
CREATE OR REPLACE FUNCTION public.notify_on_dm()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_actor_name text; v_alias text;
BEGIN
  IF NEW.sender_id = NEW.recipient_id THEN RETURN NEW; END IF;
  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = NEW.sender_id;
  SELECT alias INTO v_alias FROM member_aliases WHERE user_id = NEW.recipient_id AND target_user_id = NEW.sender_id LIMIT 1;
  INSERT INTO notifications (user_id, type, title, message, related_user_id, link)
  VALUES (NEW.recipient_id, 'direct_message', 'New Message',
    COALESCE(v_alias, v_actor_name, 'Someone') || ' sent you a message', NEW.sender_id,
    '/messages?thread=' || NEW.sender_id::text);
  RETURN NEW;
END;
$function$;

-- 4) Fridge pin: include circle and pin id
CREATE OR REPLACE FUNCTION public.notify_on_fridge_pin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_actor_name text; v_alias text; v_member record; v_circle_name text;
BEGIN
  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = NEW.pinned_by;
  SELECT name INTO v_circle_name FROM circles WHERE id = NEW.circle_id;
  FOR v_member IN
    SELECT cm.user_id FROM circle_memberships cm WHERE cm.circle_id = NEW.circle_id AND cm.user_id <> NEW.pinned_by
    UNION SELECT c.owner_id FROM circles c WHERE c.id = NEW.circle_id AND c.owner_id <> NEW.pinned_by
  LOOP
    SELECT alias INTO v_alias FROM member_aliases WHERE user_id = v_member.user_id AND target_user_id = NEW.pinned_by LIMIT 1;
    INSERT INTO notifications (user_id, type, title, message, related_circle_id, link)
    VALUES (v_member.user_id, 'fridge_pin', 'New Fridge Pin',
      COALESCE(v_alias, v_actor_name, 'Someone') || ' pinned "' || NEW.title || '" in ' || COALESCE(v_circle_name, 'the Fridge'),
      NEW.circle_id, '/fridge?circle=' || NEW.circle_id::text || '&pin=' || NEW.id::text);
  END LOOP;
  RETURN NEW;
END;
$function$;

-- 5) Campfire story: deep-link to pin
CREATE OR REPLACE FUNCTION public.notify_on_campfire_story()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_name text; v_alias text; v_member record;
  v_circle_id uuid; v_prompt text; v_circle_name text;
BEGIN
  SELECT fp.circle_id, fp.campfire_prompt INTO v_circle_id, v_prompt
  FROM fridge_pins fp WHERE fp.id = NEW.fridge_pin_id;
  IF v_circle_id IS NULL THEN RETURN NEW; END IF;
  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = NEW.author_id;
  SELECT name INTO v_circle_name FROM circles WHERE id = v_circle_id;
  FOR v_member IN
    SELECT cm.user_id FROM circle_memberships cm WHERE cm.circle_id = v_circle_id AND cm.user_id <> NEW.author_id
    UNION SELECT c.owner_id FROM circles c WHERE c.id = v_circle_id AND c.owner_id <> NEW.author_id
  LOOP
    SELECT alias INTO v_alias FROM member_aliases WHERE user_id = v_member.user_id AND target_user_id = NEW.author_id LIMIT 1;
    INSERT INTO notifications (user_id, type, title, message, related_circle_id, link)
    VALUES (
      v_member.user_id, 'campfire_story', 'New Campfire Response',
      COALESCE(v_alias, v_actor_name, 'Someone') || ' shared a story in ' || COALESCE(v_circle_name, 'the Campfire'),
      v_circle_id,
      '/fridge?circle=' || v_circle_id::text || '&pin=' || NEW.fridge_pin_id::text
    );
  END LOOP;
  RETURN NEW;
END;
$function$;

-- 6) Event RSVP: deep-link to specific event
CREATE OR REPLACE FUNCTION public.notify_on_rsvp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_creator uuid; v_circle_id uuid; v_title text; v_event_date date;
  v_actor_name text; v_alias text; v_status_text text;
BEGIN
  SELECT created_by, circle_id, title, event_date
    INTO v_creator, v_circle_id, v_title, v_event_date
  FROM events WHERE id = NEW.event_id;
  IF v_creator IS NULL OR v_creator = NEW.user_id THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = NEW.user_id;
  SELECT alias INTO v_alias FROM member_aliases WHERE user_id = v_creator AND target_user_id = NEW.user_id LIMIT 1;
  v_status_text := CASE NEW.status
    WHEN 'going' THEN 'is going to'
    WHEN 'maybe' THEN 'might attend'
    WHEN 'not_going' THEN 'can''t make it to'
    ELSE 'RSVP''d to'
  END;
  INSERT INTO notifications (user_id, type, title, message, related_circle_id, link)
  VALUES (
    v_creator, 'event_rsvp', 'New RSVP',
    COALESCE(v_alias, v_actor_name, 'Someone') || ' ' || v_status_text || ' "' || v_title || '"',
    v_circle_id,
    '/events?circle=' || v_circle_id::text || '&eventId=' || NEW.event_id::text
  );
  RETURN NEW;
END;
$function$;

-- 7) Event created: add circle param
CREATE OR REPLACE FUNCTION public.notify_on_event_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_actor_name text; v_alias text; v_member record; v_circle_name text;
BEGIN
  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = NEW.created_by;
  SELECT name INTO v_circle_name FROM circles WHERE id = NEW.circle_id;
  FOR v_member IN
    SELECT cm.user_id FROM circle_memberships cm WHERE cm.circle_id = NEW.circle_id AND cm.user_id <> NEW.created_by
    UNION SELECT c.owner_id FROM circles c WHERE c.id = NEW.circle_id AND c.owner_id <> NEW.created_by
  LOOP
    SELECT alias INTO v_alias FROM member_aliases WHERE user_id = v_member.user_id AND target_user_id = NEW.created_by LIMIT 1;
    INSERT INTO notifications (user_id, type, title, message, related_circle_id, link)
    VALUES (v_member.user_id, 'event_created', 'New Event',
      COALESCE(v_alias, v_actor_name, 'Someone') || ' added "' || NEW.title || '" in ' || COALESCE(v_circle_name, 'your circle') || ' — RSVP now!',
      NEW.circle_id, '/events?circle=' || NEW.circle_id::text || '&eventId=' || NEW.id::text);
  END LOOP;
  RETURN NEW;
END;
$function$;

-- 8) Album created: align with Albums.tsx param names (?circle=&album=)
CREATE OR REPLACE FUNCTION public.notify_on_album_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_actor_name text; v_alias text; v_member record; v_circle_name text;
BEGIN
  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = NEW.created_by;
  SELECT name INTO v_circle_name FROM circles WHERE id = NEW.circle_id;
  FOR v_member IN
    SELECT cm.user_id FROM circle_memberships cm WHERE cm.circle_id = NEW.circle_id AND cm.user_id <> NEW.created_by
    UNION SELECT c.owner_id FROM circles c WHERE c.id = NEW.circle_id AND c.owner_id <> NEW.created_by
  LOOP
    SELECT alias INTO v_alias FROM member_aliases
      WHERE user_id = v_member.user_id AND target_user_id = NEW.created_by LIMIT 1;
    INSERT INTO notifications (user_id, type, title, message, related_circle_id, link)
    VALUES (
      v_member.user_id, 'new_album', 'New Album',
      COALESCE(v_alias, v_actor_name, 'Someone') || ' shared "' || NEW.name || '" in ' || COALESCE(v_circle_name, 'your circle'),
      NEW.circle_id,
      '/albums?circle=' || NEW.circle_id::text || '&album=' || NEW.id::text
    );
  END LOOP;
  RETURN NEW;
END;
$function$;
