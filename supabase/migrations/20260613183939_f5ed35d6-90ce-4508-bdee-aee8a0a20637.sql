
CREATE OR REPLACE FUNCTION public.get_trigger_secret(_key text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM private.trigger_config WHERE key = _key;
$$;

REVOKE ALL ON FUNCTION public.get_trigger_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_trigger_secret(text) TO service_role;
