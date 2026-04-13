
CREATE TABLE public.admin_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_email text NOT NULL,
  action_type text NOT NULL,
  target_user_id uuid,
  target_content_id uuid,
  details jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
