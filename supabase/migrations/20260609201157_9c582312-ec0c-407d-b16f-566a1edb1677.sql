CREATE OR REPLACE FUNCTION public.notify_on_dm()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_name text;
  v_alias text;
  v_circle_id uuid;
  v_link text;
BEGIN
  IF NEW.sender_id = NEW.recipient_id THEN RETURN NEW; END IF;

  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = NEW.sender_id;
  SELECT alias INTO v_alias FROM member_aliases
    WHERE user_id = NEW.recipient_id AND target_user_id = NEW.sender_id
    LIMIT 1;

  -- Pick a shared circle deterministically (any circle both users belong to,
  -- considering owner or member). Most-recently-created circle wins, so the
  -- deep link reliably points the recipient at a circle that contains the sender.
  SELECT c.id INTO v_circle_id
  FROM circles c
  WHERE (
          c.owner_id = NEW.sender_id
          OR EXISTS (SELECT 1 FROM circle_memberships m
                     WHERE m.circle_id = c.id AND m.user_id = NEW.sender_id)
        )
    AND (
          c.owner_id = NEW.recipient_id
          OR EXISTS (SELECT 1 FROM circle_memberships m
                     WHERE m.circle_id = c.id AND m.user_id = NEW.recipient_id)
        )
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_circle_id IS NOT NULL THEN
    v_link := '/messages?circle=' || v_circle_id::text || '&thread=' || NEW.sender_id::text;
  ELSE
    v_link := '/messages?thread=' || NEW.sender_id::text;
  END IF;

  INSERT INTO notifications (user_id, type, title, message, related_user_id, related_circle_id, link)
  VALUES (
    NEW.recipient_id,
    'direct_message',
    'New Message',
    COALESCE(v_alias, v_actor_name, 'Someone') || ' sent you a message',
    NEW.sender_id,
    v_circle_id,
    v_link
  );
  RETURN NEW;
END;
$function$;