
-- 1. Event created → notify circle members
CREATE OR REPLACE FUNCTION public.notify_on_event_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      '/events'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_event_created
  AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION notify_on_event_created();

-- 2. Fridge pin → notify circle members
CREATE OR REPLACE FUNCTION public.notify_on_fridge_pin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_name text;
  v_member record;
BEGIN
  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = NEW.pinned_by;

  FOR v_member IN
    SELECT cm.user_id FROM circle_memberships cm WHERE cm.circle_id = NEW.circle_id AND cm.user_id <> NEW.pinned_by
    UNION
    SELECT c.owner_id FROM circles c WHERE c.id = NEW.circle_id AND c.owner_id <> NEW.pinned_by
  LOOP
    INSERT INTO notifications (user_id, type, title, message, related_circle_id, link)
    VALUES (
      v_member.user_id,
      'fridge_pin',
      'New Fridge Pin',
      COALESCE(v_actor_name, 'Someone') || ' pinned "' || NEW.title || '" to the Family Fridge',
      NEW.circle_id,
      '/fridge'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_fridge_pin
  AFTER INSERT ON fridge_pins
  FOR EACH ROW EXECUTE FUNCTION notify_on_fridge_pin();

-- 3. Reaction → notify post author
CREATE OR REPLACE FUNCTION public.notify_on_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_name text;
  v_post_author uuid;
  v_circle_id uuid;
BEGIN
  SELECT p.author_id, p.circle_id INTO v_post_author, v_circle_id FROM posts p WHERE p.id = NEW.post_id;

  IF v_post_author IS NULL OR v_post_author = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = NEW.user_id;

  INSERT INTO notifications (user_id, type, title, message, related_post_id, related_user_id, related_circle_id, link)
  VALUES (
    v_post_author,
    'reaction',
    'New Reaction',
    COALESCE(v_actor_name, 'Someone') || ' loved your post',
    NEW.post_id,
    NEW.user_id,
    v_circle_id,
    '/feed'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_reaction
  AFTER INSERT ON reactions
  FOR EACH ROW EXECUTE FUNCTION notify_on_reaction();

-- 4. DM → notify recipient
CREATE OR REPLACE FUNCTION public.notify_on_dm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_name text;
BEGIN
  IF NEW.sender_id = NEW.recipient_id THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = NEW.sender_id;

  INSERT INTO notifications (user_id, type, title, message, related_user_id, link)
  VALUES (
    NEW.recipient_id,
    'direct_message',
    'New Message',
    COALESCE(v_actor_name, 'Someone') || ' sent you a message',
    NEW.sender_id,
    '/messages'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_dm
  AFTER INSERT ON private_messages
  FOR EACH ROW EXECUTE FUNCTION notify_on_dm();

-- 5. @mention notification RPC (called from frontend after post creation)
CREATE OR REPLACE FUNCTION public.create_mention_notifications(
  _mentioned_user_ids uuid[],
  _post_id uuid,
  _circle_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_name text;
  v_uid uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = auth.uid();

  FOREACH v_uid IN ARRAY _mentioned_user_ids
  LOOP
    IF v_uid <> auth.uid() THEN
      INSERT INTO notifications (user_id, type, title, message, related_post_id, related_user_id, related_circle_id, link)
      VALUES (
        v_uid,
        'mention',
        'You were mentioned',
        COALESCE(v_actor_name, 'Someone') || ' mentioned you in a post',
        _post_id,
        auth.uid(),
        _circle_id,
        '/feed'
      );
    END IF;
  END LOOP;
END;
$$;
