
-- ============================================================
-- TRACK 1: Push reliability — delivery log + token TTL
-- ============================================================

-- push_delivery_log: per-attempt audit trail (service-role only writes)
CREATE TABLE IF NOT EXISTS public.push_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid,
  user_id uuid,
  platform text,
  status text NOT NULL,                  -- 'sent' | 'failed' | 'invalid_token' | 'skipped_pref' | 'cred_failure'
  reason text,
  attempts int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_delivery_log_created_at
  ON public.push_delivery_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_delivery_log_status_created
  ON public.push_delivery_log(status, created_at DESC);

GRANT SELECT ON public.push_delivery_log TO authenticated;
GRANT ALL ON public.push_delivery_log TO service_role;

ALTER TABLE public.push_delivery_log ENABLE ROW LEVEL SECURITY;

-- Only platform admins can read; service role bypasses RLS for writes
CREATE POLICY "Platform admins can view push delivery log"
  ON public.push_delivery_log
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- push_tokens: last_used_at for stale-token reaping
ALTER TABLE public.push_tokens
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_push_tokens_last_used
  ON public.push_tokens(last_used_at);

-- ============================================================
-- TRACK 2a: notifications — drop client INSERT, route via RPCs
-- ============================================================

DROP POLICY IF EXISTS "Users can create own notifications" ON public.notifications;
-- (Reads/updates/deletes scoped to auth.uid() = user_id remain unchanged.)

-- Generic owner-driven fan-out (transfer_block, circle_rescue, ownership_claimed targets)
CREATE OR REPLACE FUNCTION public.notify_circle_members_fan(
  _circle_id uuid,
  _type text,
  _title text,
  _message text,
  _link text DEFAULT NULL,
  _user_ids uuid[] DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_owner boolean;
  v_count int := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _type NOT IN ('transfer_block','circle_rescue','ownership_claimed','plan_change','circle_announcement') THEN
    RAISE EXCEPTION 'Type % not allowed for owner fan-out', _type;
  END IF;

  SELECT EXISTS(SELECT 1 FROM circles WHERE id = _circle_id AND owner_id = v_caller)
    INTO v_is_owner;
  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Only the circle owner may broadcast this notification';
  END IF;

  IF _user_ids IS NULL THEN
    INSERT INTO notifications (user_id, type, title, message, related_circle_id, related_user_id, link)
    SELECT cm.user_id, _type, _title, _message, _circle_id, v_caller, _link
    FROM circle_memberships cm
    WHERE cm.circle_id = _circle_id AND cm.user_id <> v_caller;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSE
    INSERT INTO notifications (user_id, type, title, message, related_circle_id, related_user_id, link)
    SELECT u, _type, _title, _message, _circle_id, v_caller, _link
    FROM unnest(_user_ids) AS u
    WHERE u <> v_caller
      AND (
        EXISTS (SELECT 1 FROM circle_memberships WHERE circle_id = _circle_id AND user_id = u)
        OR EXISTS (SELECT 1 FROM circles WHERE id = _circle_id AND owner_id = u)
      );
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_circle_members_fan(uuid,text,text,text,text,uuid[]) TO authenticated;

-- Comment / reply notifications (caller is comment author)
CREATE OR REPLACE FUNCTION public.notify_comment(
  _post_id uuid,
  _content text,
  _parent_comment_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_post posts%ROWTYPE;
  v_parent_author uuid;
  v_actor_name text;
  v_alias text;
  v_snippet text := COALESCE(left(_content, 100), '');
  v_link text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_post FROM posts WHERE id = _post_id;
  IF v_post.id IS NULL THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  IF NOT public.is_circle_member(v_caller, v_post.circle_id) THEN
    RAISE EXCEPTION 'Not authorized for this circle';
  END IF;

  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = v_caller;
  v_link := '/feed?circle=' || v_post.circle_id::text || '&post=' || _post_id::text;

  -- Reply to parent comment
  IF _parent_comment_id IS NOT NULL THEN
    SELECT author_id INTO v_parent_author FROM comments WHERE id = _parent_comment_id AND post_id = _post_id;
    IF v_parent_author IS NOT NULL AND v_parent_author <> v_caller THEN
      SELECT alias INTO v_alias FROM member_aliases
        WHERE user_id = v_parent_author AND target_user_id = v_caller LIMIT 1;
      INSERT INTO notifications (user_id, type, title, message, related_post_id, related_user_id, related_circle_id, link)
      VALUES (
        v_parent_author, 'comment_reply', 'Reply to your comment',
        COALESCE(v_alias, v_actor_name, 'Someone') || ' replied: "' || v_snippet || '"',
        _post_id, v_caller, v_post.circle_id, v_link
      );
    END IF;
  END IF;

  -- Notify post author (skip if same as parent author already notified or self)
  IF v_post.author_id <> v_caller AND (v_parent_author IS NULL OR v_post.author_id <> v_parent_author) THEN
    SELECT alias INTO v_alias FROM member_aliases
      WHERE user_id = v_post.author_id AND target_user_id = v_caller LIMIT 1;
    INSERT INTO notifications (user_id, type, title, message, related_post_id, related_user_id, related_circle_id, link)
    VALUES (
      v_post.author_id, 'comment',
      CASE WHEN _parent_comment_id IS NOT NULL THEN 'New reply on your post' ELSE 'New comment on your post' END,
      COALESCE(v_alias, v_actor_name, 'Someone') || ': "' || v_snippet || '"',
      _post_id, v_caller, v_post.circle_id, v_link
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_comment(uuid,text,uuid) TO authenticated;

-- Upgrade request: caller is a circle member, recipient is the owner. 24h dedupe.
CREATE OR REPLACE FUNCTION public.notify_upgrade_request(_circle_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_circle circles%ROWTYPE;
  v_member_count int;
  v_owner_limit int;
  v_actor_name text;
  v_recent_count int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_circle FROM circles WHERE id = _circle_id;
  IF v_circle.id IS NULL THEN
    RAISE EXCEPTION 'Circle not found';
  END IF;
  IF v_circle.owner_id = v_caller THEN
    RAISE EXCEPTION 'You are the owner';
  END IF;
  IF NOT public.is_circle_member(v_caller, _circle_id) THEN
    RAISE EXCEPTION 'Not authorized for this circle';
  END IF;

  -- 24h dedupe per (owner, type, circle, related_user)
  SELECT COUNT(*) INTO v_recent_count
  FROM notifications
  WHERE user_id = v_circle.owner_id
    AND type = 'upgrade_request'
    AND related_circle_id = _circle_id
    AND related_user_id = v_caller
    AND created_at > now() - interval '1 day';
  IF v_recent_count > 0 THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO v_member_count FROM circle_memberships WHERE circle_id = _circle_id;
  SELECT COALESCE(max_members_per_circle, 8) INTO v_owner_limit FROM user_plans WHERE user_id = v_circle.owner_id;
  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = v_caller;

  INSERT INTO notifications (user_id, type, title, message, related_circle_id, related_user_id, link)
  VALUES (
    v_circle.owner_id,
    'upgrade_request',
    'Upgrade Request',
    COALESCE(v_actor_name, 'A member') || ' is requesting you upgrade ' || v_circle.name
      || ' (' || v_member_count::text || '/' || COALESCE(v_owner_limit, 0)::text || ' members)',
    _circle_id,
    v_caller,
    '/circles'
  );
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_upgrade_request(uuid) TO authenticated;

-- Group chat add: caller created the group, recipients must be members of that group.
CREATE OR REPLACE FUNCTION public.notify_group_chat_added(
  _group_chat_id uuid,
  _user_ids uuid[],
  _group_name text,
  _circle_id uuid
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_creator uuid;
  v_count int := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT created_by INTO v_creator FROM group_chats WHERE id = _group_chat_id;
  IF v_creator IS NULL OR v_creator <> v_caller THEN
    RAISE EXCEPTION 'Only the group chat creator can send these notifications';
  END IF;

  INSERT INTO notifications (user_id, type, title, message, related_circle_id, related_user_id, link)
  SELECT u, 'group_chat', 'Added to group chat',
         'You were added to "' || _group_name || '"',
         _circle_id, v_caller,
         '/messages?circle=' || _circle_id::text || '&group=' || _group_chat_id::text
  FROM unnest(_user_ids) AS u
  WHERE u <> v_caller
    AND EXISTS (SELECT 1 FROM group_chat_members WHERE group_chat_id = _group_chat_id AND user_id = u);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_group_chat_added(uuid,uuid[],text,uuid) TO authenticated;

-- ============================================================
-- TRACK 2b: private_messages — shared circle + not-blocked
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_dm(_sender uuid, _recipient uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _sender IS NOT NULL
     AND _recipient IS NOT NULL
     AND _sender <> _recipient
     AND public.shares_circle_with(_sender, _recipient)
     AND NOT EXISTS (
       SELECT 1 FROM public.blocked_users
       WHERE (blocker_id = _recipient AND blocked_id = _sender)
          OR (blocker_id = _sender   AND blocked_id = _recipient)
     );
$$;

GRANT EXECUTE ON FUNCTION public.can_dm(uuid,uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can send messages" ON public.private_messages;
CREATE POLICY "Users can send messages"
  ON public.private_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND public.can_dm(auth.uid(), recipient_id)
  );
