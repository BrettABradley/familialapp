
CREATE OR REPLACE FUNCTION public.create_everyone_mention_notifications(_post_id uuid, _circle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_name text;
  v_alias text;
  v_member record;
  v_circle_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Caller must belong to the circle they're @everyone-ing.
  IF NOT public.is_circle_member(auth.uid(), _circle_id) THEN
    RAISE EXCEPTION 'Not authorized for this circle';
  END IF;

  -- Confirm the post belongs to the circle and was authored by the caller
  -- (prevents using this RPC to ping a circle with someone else's post id).
  IF NOT EXISTS (
    SELECT 1 FROM public.posts
    WHERE id = _post_id AND circle_id = _circle_id AND author_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Post not found in this circle';
  END IF;

  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = auth.uid();
  SELECT name INTO v_circle_name FROM circles WHERE id = _circle_id;

  FOR v_member IN
    SELECT cm.user_id FROM circle_memberships cm
      WHERE cm.circle_id = _circle_id AND cm.user_id <> auth.uid()
    UNION
    SELECT c.owner_id FROM circles c
      WHERE c.id = _circle_id AND c.owner_id <> auth.uid()
  LOOP
    SELECT alias INTO v_alias FROM member_aliases
      WHERE user_id = v_member.user_id AND target_user_id = auth.uid()
      LIMIT 1;

    INSERT INTO notifications (
      user_id, type, title, message,
      related_post_id, related_user_id, related_circle_id, link
    )
    VALUES (
      v_member.user_id,
      'mention_everyone',
      'Everyone mention',
      COALESCE(v_alias, v_actor_name, 'Someone') ||
        ' mentioned @everyone in ' || COALESCE('"' || v_circle_name || '"', 'your circle'),
      _post_id,
      auth.uid(),
      _circle_id,
      '/feed?circle=' || _circle_id::text || '&post=' || _post_id::text
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_everyone_mention_notifications(uuid, uuid) TO authenticated;
