-- Circle plan limits (backend-enforced)

-- 1) Store per-user plan limits (defaults handled in code via COALESCE)
CREATE TABLE IF NOT EXISTS public.user_plans (
  user_id uuid PRIMARY KEY,
  plan text NOT NULL DEFAULT 'free',
  max_circles integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;

-- Users can read only their own plan row
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_plans'
      AND policyname = 'Users can view own plan'
  ) THEN
    CREATE POLICY "Users can view own plan"
    ON public.user_plans
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END
$$;

-- 2) Helper function: can the given user create another circle?
CREATE OR REPLACE FUNCTION public.can_create_circle(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT COALESCE(
    (SELECT max_circles FROM public.user_plans WHERE user_id = _user_id),
    1
  ) INTO v_limit;

  SELECT COUNT(*)
  FROM public.circles
  WHERE owner_id = _user_id
  INTO v_count;

  RETURN v_count < v_limit;
END;
$$;

-- 3) Public RPC helpers for the UI
CREATE OR REPLACE FUNCTION public.get_circle_limit()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT max_circles FROM public.user_plans WHERE user_id = auth.uid()), 1);
$$;

CREATE OR REPLACE FUNCTION public.get_circle_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.circles WHERE owner_id = auth.uid();
$$;

-- 4) Update circles INSERT policy to enforce plan limit
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'circles'
      AND policyname = 'Users can create circles'
  ) THEN
    DROP POLICY "Users can create circles" ON public.circles;
  END IF;
END
$$;

CREATE POLICY "Users can create circles (within plan limit)"
ON public.circles
FOR INSERT
WITH CHECK (
  auth.uid() = owner_id
  AND public.can_create_circle(auth.uid())
);
