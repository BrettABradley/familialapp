
CREATE OR REPLACE FUNCTION public.notify_on_campfire_story()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_name text;
  v_alias text;
  v_member record;
  v_circle_id uuid;
  v_prompt text;
BEGIN
  -- Get the circle_id and prompt from the fridge pin
  SELECT fp.circle_id, fp.campfire_prompt INTO v_circle_id, v_prompt
  FROM fridge_pins fp
  WHERE fp.id = NEW.fridge_pin_id;

  IF v_circle_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get actor display name
  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = NEW.author_id;

  -- Notify all circle members except the author
  FOR v_member IN
    SELECT cm.user_id FROM circle_memberships cm WHERE cm.circle_id = v_circle_id AND cm.user_id <> NEW.author_id
    UNION
    SELECT c.owner_id FROM circles c WHERE c.id = v_circle_id AND c.owner_id <> NEW.author_id
  LOOP
    SELECT alias INTO v_alias FROM member_aliases WHERE user_id = v_member.user_id AND target_user_id = NEW.author_id LIMIT 1;

    INSERT INTO notifications (user_id, type, title, message, related_circle_id, link)
    VALUES (
      v_member.user_id,
      'campfire_story',
      'New Campfire Response',
      COALESCE(v_alias, v_actor_name, 'Someone') || ' shared a story around the campfire',
      v_circle_id,
      '/fridge'
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_campfire_story_created
  AFTER INSERT ON public.campfire_stories
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_campfire_story();
