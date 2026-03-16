-- Store the anon key in vault so the trigger can call edge functions
SELECT vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4a3d4b2xzc2FwYXlxeWZkd3FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1OTAzOTIsImV4cCI6MjA4NDE2NjM5Mn0.rovzF9i3wB0zcKs7311W_9sQozzDu0b-U7BnIZjFgls',
  'SUPABASE_ANON_KEY'
);

-- Update trigger to use anon key instead of service role key
-- The edge function itself uses its own env vars for service role access
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_url text;
  v_anon_key text;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_URL'
  LIMIT 1;

  SELECT decrypted_secret INTO v_anon_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_ANON_KEY'
  LIMIT 1;

  IF v_url IS NULL OR v_anon_key IS NULL THEN
    RAISE LOG 'Skipping push notification for notification % - vault secrets unavailable', NEW.id;
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := v_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key,
        'apikey', v_anon_key
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