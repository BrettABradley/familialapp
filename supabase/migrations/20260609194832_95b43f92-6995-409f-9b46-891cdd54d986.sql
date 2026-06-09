CREATE OR REPLACE FUNCTION public.trigger_push_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_url text;
  v_service_key text;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets
  WHERE name IN ('SUPABASE_URL','project_url','supabase_url')
  ORDER BY name
  LIMIT 1;

  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name IN ('SUPABASE_SERVICE_ROLE_KEY','email_queue_service_role_key','service_role_key')
  ORDER BY name
  LIMIT 1;

  IF v_url IS NULL THEN
    v_url := 'https://qxkwxolssapayqyfdwqc.supabase.co';
  END IF;

  IF v_service_key IS NULL THEN
    RAISE LOG 'Skipping push notification for notification % - no service role key found in vault', NEW.id;
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := v_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key,
        'apikey', v_service_key
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
$function$;

CREATE OR REPLACE FUNCTION public.trigger_notification_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_url text;
  v_service_key text;
  v_recipient_email text;
  v_pref_mention boolean;
  v_pref_album boolean;
  v_template text;
  v_actor_name text;
  v_circle_name text;
  v_should_send boolean := false;
BEGIN
  IF NEW.type NOT IN ('mention', 'new_album') THEN
    RETURN NEW;
  END IF;

  SELECT au.email, p.email_on_mention, p.email_on_new_album
  INTO v_recipient_email, v_pref_mention, v_pref_album
  FROM auth.users au
  LEFT JOIN profiles p ON p.user_id = au.id
  WHERE au.id = NEW.user_id;

  IF v_recipient_email IS NULL THEN RETURN NEW; END IF;

  IF NEW.type = 'mention' AND COALESCE(v_pref_mention, true) THEN
    v_template := 'mention-notification'; v_should_send := true;
  ELSIF NEW.type = 'new_album' AND COALESCE(v_pref_album, true) THEN
    v_template := 'new-album'; v_should_send := true;
  END IF;

  IF NOT v_should_send THEN RETURN NEW; END IF;

  IF NEW.related_user_id IS NOT NULL THEN
    SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = NEW.related_user_id;
  END IF;
  IF NEW.related_circle_id IS NOT NULL THEN
    SELECT name INTO v_circle_name FROM circles WHERE id = NEW.related_circle_id;
  END IF;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets
  WHERE name IN ('SUPABASE_URL','project_url','supabase_url')
  ORDER BY name
  LIMIT 1;

  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name IN ('SUPABASE_SERVICE_ROLE_KEY','email_queue_service_role_key','service_role_key')
  ORDER BY name
  LIMIT 1;

  IF v_url IS NULL THEN
    v_url := 'https://qxkwxolssapayqyfdwqc.supabase.co';
  END IF;

  IF v_service_key IS NULL THEN
    RAISE LOG 'trigger_notification_email: no service role key found in vault for notification %', NEW.id;
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := v_url || '/functions/v1/send-transactional-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key,
        'apikey', v_service_key
      ),
      body := jsonb_build_object(
        'templateName', v_template,
        'recipientEmail', v_recipient_email,
        'idempotencyKey', v_template || '-' || NEW.id::text,
        'templateData', jsonb_build_object(
          'actorName', COALESCE(v_actor_name, 'Someone'),
          'circleName', COALESCE(v_circle_name, 'your circle'),
          'context', CASE WHEN NEW.type = 'mention' THEN 'a post' ELSE NULL END,
          'snippet', NEW.message,
          'albumTitle', CASE WHEN NEW.type = 'new_album'
            THEN regexp_replace(NEW.message, '^.*"([^"]+)".*$', '\1') ELSE NULL END,
          'url', CASE WHEN NEW.link IS NOT NULL
            THEN 'https://www.familialmedia.com' || NEW.link
            ELSE 'https://www.familialmedia.com' END
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'trigger_notification_email failed for notification %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;