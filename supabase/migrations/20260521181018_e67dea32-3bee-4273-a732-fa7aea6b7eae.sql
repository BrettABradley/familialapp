-- Auto-promote support@familialmedia.com to platform_admin on signup
CREATE OR REPLACE FUNCTION public.auto_promote_support_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'support@familialmedia.com' THEN
    INSERT INTO public.platform_admins (user_id, note)
    VALUES (NEW.id, 'Auto-promoted support inbox account')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_promote_support ON auth.users;
CREATE TRIGGER on_auth_user_created_promote_support
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_promote_support_admin();