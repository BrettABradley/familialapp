ALTER TABLE public.user_plans
  ADD COLUMN max_members_per_circle integer NOT NULL DEFAULT 8;

UPDATE public.user_plans SET max_members_per_circle = 20 WHERE plan = 'family';
UPDATE public.user_plans SET max_members_per_circle = 35 WHERE plan = 'extended';