
-- 1) Track comps on user_plans
ALTER TABLE public.user_plans
  ADD COLUMN IF NOT EXISTS comped_by_admin_at timestamptz,
  ADD COLUMN IF NOT EXISTS comp_note text;

-- 2) Allow platform admins to insert/delete platform_admins (self-removal blocked in edge fn)
DROP POLICY IF EXISTS "Platform admins can add admins" ON public.platform_admins;
CREATE POLICY "Platform admins can add admins"
ON public.platform_admins
FOR INSERT
WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins can remove admins" ON public.platform_admins;
CREATE POLICY "Platform admins can remove admins"
ON public.platform_admins
FOR DELETE
USING (public.is_platform_admin(auth.uid()));

-- 3) Enterprise accounts
CREATE TABLE IF NOT EXISTS public.enterprise_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  contact_email text NOT NULL,
  agreed_price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  billing_cadence text NOT NULL DEFAULT 'monthly',
  next_invoice_due_at timestamptz,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.enterprise_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage enterprise accounts (select)" ON public.enterprise_accounts;
CREATE POLICY "Platform admins manage enterprise accounts (select)"
ON public.enterprise_accounts FOR SELECT
USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins manage enterprise accounts (insert)" ON public.enterprise_accounts;
CREATE POLICY "Platform admins manage enterprise accounts (insert)"
ON public.enterprise_accounts FOR INSERT
WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins manage enterprise accounts (update)" ON public.enterprise_accounts;
CREATE POLICY "Platform admins manage enterprise accounts (update)"
ON public.enterprise_accounts FOR UPDATE
USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins manage enterprise accounts (delete)" ON public.enterprise_accounts;
CREATE POLICY "Platform admins manage enterprise accounts (delete)"
ON public.enterprise_accounts FOR DELETE
USING (public.is_platform_admin(auth.uid()));

CREATE TRIGGER update_enterprise_accounts_updated_at
BEFORE UPDATE ON public.enterprise_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Validation trigger on user_plans for enterprise limits
CREATE OR REPLACE FUNCTION public.validate_user_plan_limits()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.plan = 'enterprise' THEN
    IF NEW.max_circles IS NULL OR NEW.max_circles < 1 OR NEW.max_circles > 10000 THEN
      RAISE EXCEPTION 'enterprise max_circles must be between 1 and 10000';
    END IF;
    IF NEW.max_members_per_circle IS NULL OR NEW.max_members_per_circle < 1 OR NEW.max_members_per_circle > 10000 THEN
      RAISE EXCEPTION 'enterprise max_members_per_circle must be between 1 and 10000';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_user_plan_limits_trigger ON public.user_plans;
CREATE TRIGGER validate_user_plan_limits_trigger
BEFORE INSERT OR UPDATE ON public.user_plans
FOR EACH ROW EXECUTE FUNCTION public.validate_user_plan_limits();
