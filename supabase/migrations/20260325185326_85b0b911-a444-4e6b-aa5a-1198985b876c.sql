
-- Make aliases global per person (remove circle_id scoping)
ALTER TABLE member_aliases DROP CONSTRAINT IF EXISTS member_aliases_user_id_target_user_id_circle_id_key;

DELETE FROM member_aliases a
USING member_aliases b
WHERE a.user_id = b.user_id
  AND a.target_user_id = b.target_user_id
  AND a.created_at < b.created_at;

ALTER TABLE member_aliases ADD CONSTRAINT member_aliases_user_id_target_user_id_key UNIQUE (user_id, target_user_id);

DROP POLICY IF EXISTS "Users can create own aliases" ON member_aliases;
CREATE POLICY "Users can create own aliases" ON member_aliases
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND shares_circle_with(auth.uid(), target_user_id));

CREATE OR REPLACE FUNCTION public.notify_on_event_created()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_actor_name text; v_alias text; v_member record;
BEGIN
  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = NEW.created_by;
  FOR v_member IN
    SELECT cm.user_id FROM circle_memberships cm WHERE cm.circle_id = NEW.circle_id AND cm.user_id <> NEW.created_by
    UNION SELECT c.owner_id FROM circles c WHERE c.id = NEW.circle_id AND c.owner_id <> NEW.created_by
  LOOP
    SELECT alias INTO v_alias FROM member_aliases WHERE user_id = v_member.user_id AND target_user_id = NEW.created_by LIMIT 1;
    INSERT INTO notifications (user_id, type, title, message, related_circle_id, link)
    VALUES (v_member.user_id, 'event_created', 'New Event',
      COALESCE(v_alias, v_actor_name, 'Someone') || ' added "' || NEW.title || '" — RSVP now!',
      NEW.circle_id, '/events?eventId=' || NEW.id);
  END LOOP;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_fridge_pin()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_actor_name text; v_alias text; v_member record;
BEGIN
  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = NEW.pinned_by;
  FOR v_member IN
    SELECT cm.user_id FROM circle_memberships cm WHERE cm.circle_id = NEW.circle_id AND cm.user_id <> NEW.pinned_by
    UNION SELECT c.owner_id FROM circles c WHERE c.id = NEW.circle_id AND c.owner_id <> NEW.pinned_by
  LOOP
    SELECT alias INTO v_alias FROM member_aliases WHERE user_id = v_member.user_id AND target_user_id = NEW.pinned_by LIMIT 1;
    INSERT INTO notifications (user_id, type, title, message, related_circle_id, link)
    VALUES (v_member.user_id, 'fridge_pin', 'New Fridge Pin',
      COALESCE(v_alias, v_actor_name, 'Someone') || ' pinned "' || NEW.title || '" to the Family Fridge',
      NEW.circle_id, '/fridge');
  END LOOP;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_dm()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_actor_name text; v_alias text;
BEGIN
  IF NEW.sender_id = NEW.recipient_id THEN RETURN NEW; END IF;
  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = NEW.sender_id;
  SELECT alias INTO v_alias FROM member_aliases WHERE user_id = NEW.recipient_id AND target_user_id = NEW.sender_id LIMIT 1;
  INSERT INTO notifications (user_id, type, title, message, related_user_id, link)
  VALUES (NEW.recipient_id, 'direct_message', 'New Message',
    COALESCE(v_alias, v_actor_name, 'Someone') || ' sent you a message', NEW.sender_id, '/messages');
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_mention_notifications(_mentioned_user_ids uuid[], _post_id uuid, _circle_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_actor_name text; v_alias text; v_uid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = auth.uid();
  FOREACH v_uid IN ARRAY _mentioned_user_ids LOOP
    IF v_uid <> auth.uid() THEN
      SELECT alias INTO v_alias FROM member_aliases WHERE user_id = v_uid AND target_user_id = auth.uid() LIMIT 1;
      INSERT INTO notifications (user_id, type, title, message, related_post_id, related_user_id, related_circle_id, link)
      VALUES (v_uid, 'mention', 'You were mentioned',
        COALESCE(v_alias, v_actor_name, 'Someone') || ' mentioned you in a post',
        _post_id, auth.uid(), _circle_id, '/feed');
    END IF;
  END LOOP;
END;
$function$;
