
-- 1. Add campfire_prompt column to fridge_pins
ALTER TABLE public.fridge_pins ADD COLUMN campfire_prompt text;

-- 2. Create campfire_stories table
CREATE TABLE public.campfire_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fridge_pin_id uuid NOT NULL REFERENCES public.fridge_pins(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (fridge_pin_id, author_id)
);

-- Validate content length
CREATE OR REPLACE FUNCTION public.validate_campfire_story()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF length(NEW.content) > 500 THEN
    RAISE EXCEPTION 'Campfire story must be 500 characters or less';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_campfire_story_trigger
  BEFORE INSERT OR UPDATE ON public.campfire_stories
  FOR EACH ROW EXECUTE FUNCTION public.validate_campfire_story();

-- Enable RLS
ALTER TABLE public.campfire_stories ENABLE ROW LEVEL SECURITY;

-- RLS: circle members can view stories for pins in their circle
CREATE POLICY "Circle members can view campfire stories"
  ON public.campfire_stories FOR SELECT
  TO authenticated
  USING (
    fridge_pin_id IN (
      SELECT fp.id FROM fridge_pins fp
      WHERE is_circle_member(auth.uid(), fp.circle_id)
    )
  );

-- RLS: circle members can insert one story per campfire
CREATE POLICY "Circle members can add campfire stories"
  ON public.campfire_stories FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND fridge_pin_id IN (
      SELECT fp.id FROM fridge_pins fp
      WHERE is_circle_member(auth.uid(), fp.circle_id)
    )
  );

-- RLS: authors can delete own stories
CREATE POLICY "Authors can delete own campfire stories"
  ON public.campfire_stories FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

-- 3. Create member_aliases table
CREATE TABLE public.member_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  alias text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_user_id, circle_id)
);

-- Validate alias length
CREATE OR REPLACE FUNCTION public.validate_member_alias()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF length(NEW.alias) > 50 THEN
    RAISE EXCEPTION 'Alias must be 50 characters or less';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_member_alias_trigger
  BEFORE INSERT OR UPDATE ON public.member_aliases
  FOR EACH ROW EXECUTE FUNCTION public.validate_member_alias();

ALTER TABLE public.member_aliases ENABLE ROW LEVEL SECURITY;

-- RLS: users can manage their own aliases
CREATE POLICY "Users can view own aliases"
  ON public.member_aliases FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own aliases"
  ON public.member_aliases FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_circle_member(auth.uid(), circle_id));

CREATE POLICY "Users can update own aliases"
  ON public.member_aliases FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own aliases"
  ON public.member_aliases FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 4. Update notification functions to use aliases

-- Update notify_on_fridge_pin to use aliases
CREATE OR REPLACE FUNCTION public.notify_on_fridge_pin()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_name text;
  v_alias text;
  v_member record;
BEGIN
  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = NEW.pinned_by;

  FOR v_member IN
    SELECT cm.user_id FROM circle_memberships cm WHERE cm.circle_id = NEW.circle_id AND cm.user_id <> NEW.pinned_by
    UNION
    SELECT c.owner_id FROM circles c WHERE c.id = NEW.circle_id AND c.owner_id <> NEW.pinned_by
  LOOP
    SELECT alias INTO v_alias FROM member_aliases
      WHERE user_id = v_member.user_id AND target_user_id = NEW.pinned_by AND circle_id = NEW.circle_id;

    INSERT INTO notifications (user_id, type, title, message, related_circle_id, link)
    VALUES (
      v_member.user_id,
      'fridge_pin',
      'New Fridge Pin',
      COALESCE(v_alias, v_actor_name, 'Someone') || ' pinned "' || NEW.title || '" to the Family Fridge',
      NEW.circle_id,
      '/fridge'
    );
  END LOOP;
  RETURN NEW;
END;
$function$;

-- Update notify_on_event_created to use aliases
CREATE OR REPLACE FUNCTION public.notify_on_event_created()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_name text;
  v_alias text;
  v_member record;
BEGIN
  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = NEW.created_by;

  FOR v_member IN
    SELECT cm.user_id FROM circle_memberships cm WHERE cm.circle_id = NEW.circle_id AND cm.user_id <> NEW.created_by
    UNION
    SELECT c.owner_id FROM circles c WHERE c.id = NEW.circle_id AND c.owner_id <> NEW.created_by
  LOOP
    SELECT alias INTO v_alias FROM member_aliases
      WHERE user_id = v_member.user_id AND target_user_id = NEW.created_by AND circle_id = NEW.circle_id;

    INSERT INTO notifications (user_id, type, title, message, related_circle_id, link)
    VALUES (
      v_member.user_id,
      'event_created',
      'New Event',
      COALESCE(v_alias, v_actor_name, 'Someone') || ' added "' || NEW.title || '" — RSVP now!',
      NEW.circle_id,
      '/events?eventId=' || NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$function$;

-- Update notify_on_dm to use aliases
CREATE OR REPLACE FUNCTION public.notify_on_dm()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_name text;
  v_alias text;
BEGIN
  IF NEW.sender_id = NEW.recipient_id THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = NEW.sender_id;

  -- Look up alias across any shared circle (pick first found)
  SELECT ma.alias INTO v_alias FROM member_aliases ma
    WHERE ma.user_id = NEW.recipient_id AND ma.target_user_id = NEW.sender_id
    LIMIT 1;

  INSERT INTO notifications (user_id, type, title, message, related_user_id, link)
  VALUES (
    NEW.recipient_id,
    'direct_message',
    'New Message',
    COALESCE(v_alias, v_actor_name, 'Someone') || ' sent you a message',
    NEW.sender_id,
    '/messages'
  );
  RETURN NEW;
END;
$function$;

-- Update create_mention_notifications to use aliases
CREATE OR REPLACE FUNCTION public.create_mention_notifications(_mentioned_user_ids uuid[], _post_id uuid, _circle_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_name text;
  v_alias text;
  v_uid uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = auth.uid();

  FOREACH v_uid IN ARRAY _mentioned_user_ids
  LOOP
    IF v_uid <> auth.uid() THEN
      SELECT alias INTO v_alias FROM member_aliases
        WHERE user_id = v_uid AND target_user_id = auth.uid() AND circle_id = _circle_id;

      INSERT INTO notifications (user_id, type, title, message, related_post_id, related_user_id, related_circle_id, link)
      VALUES (
        v_uid,
        'mention',
        'You were mentioned',
        COALESCE(v_alias, v_actor_name, 'Someone') || ' mentioned you in a post',
        _post_id,
        auth.uid(),
        _circle_id,
        '/feed'
      );
    END IF;
  END LOOP;
END;
$function$;

-- Validate campfire_prompt length on fridge_pins
CREATE OR REPLACE FUNCTION public.validate_fridge_pin()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF length(NEW.title) > 100 THEN
    RAISE EXCEPTION 'Pin title must be 100 characters or less';
  END IF;
  IF NEW.content IS NOT NULL AND length(NEW.content) > 1000 THEN
    RAISE EXCEPTION 'Pin content must be 1000 characters or less';
  END IF;
  IF NEW.campfire_prompt IS NOT NULL AND length(NEW.campfire_prompt) > 200 THEN
    RAISE EXCEPTION 'Campfire prompt must be 200 characters or less';
  END IF;
  RETURN NEW;
END;
$function$;
