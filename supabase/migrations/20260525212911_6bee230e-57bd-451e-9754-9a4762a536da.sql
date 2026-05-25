-- =========================================================
-- 1. New private user table for sensitive fields
-- =========================================================
CREATE TABLE public.user_private (
  user_id uuid PRIMARY KEY,
  date_of_birth date,
  two_factor_enabled boolean NOT NULL DEFAULT false,
  account_status text NOT NULL DEFAULT 'active',
  suspended_until timestamptz,
  spam_reporter boolean NOT NULL DEFAULT false,
  accepted_terms_version text,
  accepted_terms_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_private ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own private row"
  ON public.user_private FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own private row"
  ON public.user_private FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own private row"
  ON public.user_private FOR UPDATE
  USING (auth.uid() = user_id);

-- Block end-users from self-promoting via account_status/suspended_until/spam_reporter.
CREATE OR REPLACE FUNCTION public.restrict_user_private_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role bypasses RLS entirely; this trigger only fires for end-users.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.account_status IS DISTINCT FROM OLD.account_status
     OR NEW.suspended_until IS DISTINCT FROM OLD.suspended_until
     OR NEW.spam_reporter IS DISTINCT FROM OLD.spam_reporter THEN
    RAISE EXCEPTION 'Only platform admins can change account status, suspension, or spam-reporter flags';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER restrict_user_private_update_trigger
  BEFORE UPDATE ON public.user_private
  FOR EACH ROW EXECUTE FUNCTION public.restrict_user_private_update();

CREATE TRIGGER user_private_updated_at
  BEFORE UPDATE ON public.user_private
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 2. Backfill from profiles
-- =========================================================
INSERT INTO public.user_private (
  user_id, date_of_birth, two_factor_enabled, account_status,
  suspended_until, spam_reporter, accepted_terms_version, accepted_terms_at
)
SELECT
  user_id,
  date_of_birth,
  COALESCE(two_factor_enabled, false),
  COALESCE(account_status, 'active'),
  suspended_until,
  COALESCE(spam_reporter, false),
  accepted_terms_version,
  accepted_terms_at
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- =========================================================
-- 3. Update triggers/functions that referenced the old columns
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.user_private (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_plans (user_id, plan, max_circles, max_members_per_circle)
  VALUES (NEW.id, 'free', 1, 8)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.redirect_spam_reporter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_spam boolean;
BEGIN
  SELECT spam_reporter INTO is_spam
  FROM public.user_private
  WHERE user_id = NEW.reporter_id;

  IF COALESCE(is_spam, false) THEN
    INSERT INTO public.shadow_reports
      (reporter_id, post_id, comment_id, reported_user_id, reason, details)
    VALUES
      (NEW.reporter_id, NEW.post_id, NEW.comment_id, NEW.reported_user_id, NEW.reason, NEW.details);
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- =========================================================
-- 4. Drop sensitive columns from profiles
-- =========================================================
ALTER TABLE public.profiles
  DROP COLUMN date_of_birth,
  DROP COLUMN two_factor_enabled,
  DROP COLUMN account_status,
  DROP COLUMN suspended_until,
  DROP COLUMN spam_reporter,
  DROP COLUMN accepted_terms_version,
  DROP COLUMN accepted_terms_at;

-- =========================================================
-- 5. Realtime channel authorization
-- =========================================================
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can subscribe to allowed topics"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    -- Bell notification channels: bell-<variant>-<circleId>
    (
      realtime.topic() LIKE 'bell-%-%'
      AND (
        SELECT public.is_circle_member(
          auth.uid(),
          ((regexp_match(realtime.topic(), '^bell-[^-]+-(.+)$'))[1])::uuid
        )
      )
    )
    -- Global postgres_changes channels (row-level RLS still gates the payload)
    OR realtime.topic() IN ('private-messages-realtime', 'group-messages-realtime')
  );