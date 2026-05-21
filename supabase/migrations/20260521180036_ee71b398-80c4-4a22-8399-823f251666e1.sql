
-- ============ Platform admin model ============
CREATE TABLE public.platform_admins (
  user_id uuid PRIMARY KEY,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid,
  note text
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = _user_id);
$$;

CREATE POLICY "Admins can read admin list"
  ON public.platform_admins FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

-- Seed Brett as the first platform admin
INSERT INTO public.platform_admins (user_id, note)
SELECT id, 'Founder - seeded via moderation migration'
FROM auth.users
WHERE email = 'brettbradley007@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- ============ content_reports extensions ============
ALTER TABLE public.content_reports
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'med',
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid,
  ADD COLUMN IF NOT EXISTS resolution_note text,
  ADD COLUMN IF NOT EXISTS sla_due_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours');

CREATE INDEX IF NOT EXISTS idx_content_reports_status_sla
  ON public.content_reports (status, sla_due_at);

-- Severity default-from-reason on insert
CREATE OR REPLACE FUNCTION public.set_report_severity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.severity = 'med' THEN
    NEW.severity := CASE NEW.reason
      WHEN 'harassment' THEN 'high'
      WHEN 'inappropriate' THEN 'high'
      WHEN 'spam' THEN 'low'
      ELSE 'med'
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_report_severity ON public.content_reports;
CREATE TRIGGER trg_set_report_severity
  BEFORE INSERT ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_report_severity();

-- Admin SELECT/UPDATE on reports
CREATE POLICY "Platform admins can view all reports"
  ON public.content_reports FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update reports"
  ON public.content_reports FOR UPDATE
  USING (public.is_platform_admin(auth.uid()));

-- ============ profiles: spam reporter + account status ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS spam_reporter boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspended_until timestamptz;

-- ============ shadow_reports + redirect trigger ============
CREATE TABLE public.shadow_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  post_id uuid,
  comment_id uuid,
  reported_user_id uuid,
  reason text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shadow_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view shadow reports"
  ON public.shadow_reports FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

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
  FROM public.profiles
  WHERE user_id = NEW.reporter_id;

  IF COALESCE(is_spam, false) THEN
    INSERT INTO public.shadow_reports
      (reporter_id, post_id, comment_id, reported_user_id, reason, details)
    VALUES
      (NEW.reporter_id, NEW.post_id, NEW.comment_id, NEW.reported_user_id, NEW.reason, NEW.details);
    RETURN NULL; -- silently swallow
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_redirect_spam_reporter ON public.content_reports;
CREATE TRIGGER trg_redirect_spam_reporter
  BEFORE INSERT ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.redirect_spam_reporter();

-- ============ moderation_decisions ============
CREATE TABLE public.moderation_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.content_reports(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  action text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_moderation_decisions_report ON public.moderation_decisions (report_id);
ALTER TABLE public.moderation_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view decisions"
  ON public.moderation_decisions FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert decisions"
  ON public.moderation_decisions FOR INSERT
  WITH CHECK (public.is_platform_admin(auth.uid()) AND actor_id = auth.uid());

-- ============ user_strikes ============
CREATE TABLE public.user_strikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  report_id uuid REFERENCES public.content_reports(id) ON DELETE SET NULL,
  severity text NOT NULL DEFAULT 'med',
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  voided_at timestamptz,
  voided_by uuid
);
CREATE INDEX idx_user_strikes_user_active
  ON public.user_strikes (user_id) WHERE voided_at IS NULL;
ALTER TABLE public.user_strikes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own strikes"
  ON public.user_strikes FOR SELECT
  USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can manage strikes"
  ON public.user_strikes FOR INSERT
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update strikes"
  ON public.user_strikes FOR UPDATE
  USING (public.is_platform_admin(auth.uid()));

-- ============ user_appeals ============
CREATE TABLE public.user_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,                 -- may be null if user can't log in; email used instead
  email text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text,'-',''),
  original_report_id uuid REFERENCES public.content_reports(id) ON DELETE SET NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewer_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);
CREATE INDEX idx_user_appeals_status ON public.user_appeals (status, created_at DESC);
ALTER TABLE public.user_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own appeals"
  ON public.user_appeals FOR SELECT
  USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update appeals"
  ON public.user_appeals FOR UPDATE
  USING (public.is_platform_admin(auth.uid()));

-- Appeals are inserted via edge function (service role) so no INSERT policy needed for users.

-- ============ banned_emails + admin_actions admin read ============
ALTER TABLE public.banned_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view banned emails"
  ON public.banned_emails FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert banned emails"
  ON public.banned_emails FOR INSERT
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete banned emails"
  ON public.banned_emails FOR DELETE
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can view admin actions"
  ON public.admin_actions FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert admin actions"
  ON public.admin_actions FOR INSERT
  WITH CHECK (public.is_platform_admin(auth.uid()));
