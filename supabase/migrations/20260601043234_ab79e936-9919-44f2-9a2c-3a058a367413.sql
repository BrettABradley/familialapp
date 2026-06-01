ALTER TABLE public.user_plans ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz;

UPDATE public.user_plans
SET subscription_started_at = created_at
WHERE subscription_started_at IS NULL
  AND source IN ('stripe','apple')
  AND plan IS DISTINCT FROM 'free';