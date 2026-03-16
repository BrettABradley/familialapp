-- Make push notification trigger non-blocking so message inserts never fail
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_url text;
  v_service_role_key text;
BEGIN
  -- Read secrets from vault if available
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_URL'
  LIMIT 1;

  SELECT decrypted_secret INTO v_service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
  LIMIT 1;

  -- If secrets are unavailable, skip push delivery but never block the parent insert
  IF v_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE LOG 'Skipping push notification for notification % because backend secrets are unavailable', NEW.id;
    RETURN NEW;
  END IF;

  -- Fire-and-forget HTTP call via pg_net; swallow any unexpected errors
  BEGIN
    PERFORM net.http_post(
      url := v_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := jsonb_build_object(
        'record', jsonb_build_object(
          'id', NEW.id,
          'user_id', NEW.user_id,
          'title', NEW.title,
          'message', NEW.message,
          'type', NEW.type,
          'link', NEW.link
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Push notification enqueue failed for notification %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;