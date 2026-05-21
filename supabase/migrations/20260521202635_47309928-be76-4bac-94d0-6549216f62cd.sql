
CREATE TABLE public.app_version_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL UNIQUE,
  min_supported_version text NOT NULL,
  latest_version text NOT NULL,
  store_url text NOT NULL,
  update_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_version_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app version config"
  ON public.app_version_config FOR SELECT
  USING (true);

CREATE POLICY "Platform admins can insert app version config"
  ON public.app_version_config FOR INSERT
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update app version config"
  ON public.app_version_config FOR UPDATE
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete app version config"
  ON public.app_version_config FOR DELETE
  USING (public.is_platform_admin(auth.uid()));

CREATE TRIGGER update_app_version_config_updated_at
  BEFORE UPDATE ON public.app_version_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_version_config (platform, min_supported_version, latest_version, store_url, update_message)
VALUES (
  'ios',
  '1.0.0',
  '1.0.0',
  'https://apps.apple.com/app/id6760382623',
  'A new version of Familial is available with improvements and fixes.'
);
