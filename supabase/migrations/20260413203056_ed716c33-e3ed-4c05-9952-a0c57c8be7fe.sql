
-- Create banned_emails table (service-role only, no public access)
CREATE TABLE public.banned_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  banned_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  report_id uuid REFERENCES public.content_reports(id) ON DELETE SET NULL
);

ALTER TABLE public.banned_emails ENABLE ROW LEVEL SECURITY;
-- No RLS policies = no public access. Only service-role can read/write.

-- Function to block banned emails on signup
CREATE OR REPLACE FUNCTION public.check_banned_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.banned_emails WHERE email = NEW.email) THEN
    RAISE EXCEPTION 'This email address has been banned from creating an account.';
  END IF;
  RETURN NEW;
END;
$$;
