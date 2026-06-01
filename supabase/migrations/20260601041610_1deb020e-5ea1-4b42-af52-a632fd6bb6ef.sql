
-- 1. user_plans: drop broad member policy, replace with SECURITY DEFINER RPC
DROP POLICY IF EXISTS "Circle members can view circle owner plan" ON public.user_plans;

CREATE OR REPLACE FUNCTION public.get_circle_owner_limits(_circle_id uuid)
RETURNS TABLE(plan text, max_members_per_circle integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT owner_id INTO v_owner FROM public.circles WHERE id = _circle_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Circle not found';
  END IF;

  -- Caller must be owner or member of the circle
  IF NOT public.is_circle_member(auth.uid(), _circle_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT up.plan, up.max_members_per_circle
  FROM public.user_plans up
  WHERE up.user_id = v_owner;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_circle_owner_limits(uuid) TO authenticated;

-- 2. moderation_action_tokens for one-time admin email links
CREATE TABLE public.moderation_action_tokens (
  token text PRIMARY KEY,
  report_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('ban_user', 'dismiss')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.moderation_action_tokens TO service_role;
-- No anon or authenticated grants — only the service role (edge function) touches this table.

ALTER TABLE public.moderation_action_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only"
ON public.moderation_action_tokens
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX idx_moderation_action_tokens_report ON public.moderation_action_tokens(report_id);

-- 3. trigger_push_notification: call edge function with service-role key (not anon)
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_url text;
  v_service_key text;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_URL'
  LIMIT 1;

  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
  LIMIT 1;

  IF v_url IS NULL OR v_service_key IS NULL THEN
    RAISE LOG 'Skipping push notification for notification % - vault secrets unavailable (need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)', NEW.id;
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := v_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key,
        'apikey', v_service_key
      ),
      body := jsonb_build_object(
        'record', jsonb_build_object(
          'id', NEW.id,
          'user_id', NEW.user_id,
          'title', NEW.title,
          'message', NEW.message,
          'type', NEW.type,
          'link', NEW.link
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Push notification enqueue failed for notification %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

-- 4. Tighten realtime.messages subscription policy: remove ELSE true branch.
-- Allow only: CDC subscriptions (realtime:*), our own private/group message topics,
-- and bell-* topics (CDC-backed, payloads filtered by notifications table RLS).
DROP POLICY IF EXISTS "authenticated can subscribe to allowed topics" ON realtime.messages;

CREATE POLICY "authenticated can subscribe to allowed topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    -- Postgres CDC subscriptions — table-level RLS filters payloads
    WHEN realtime.topic() LIKE 'realtime:%' THEN true
    -- Per-user private/group message topics
    WHEN realtime.topic() = 'private-messages:' || auth.uid()::text THEN true
    WHEN realtime.topic() = 'group-messages:' || auth.uid()::text THEN true
    -- Bell channels are CDC-backed; the notifications-table RLS gates rows.
    -- Channel name encodes circle id but does not leak any payload.
    WHEN realtime.topic() LIKE 'bell-%' THEN true
    ELSE false
  END
);
