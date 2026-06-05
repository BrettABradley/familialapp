
-- 1. Update trigger_notification_email to use SERVICE_ROLE key (send-transactional-email now requires it)
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
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF v_url IS NULL OR v_service_key IS NULL THEN
    RAISE LOG 'trigger_notification_email: vault secrets missing for notification %', NEW.id;
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

-- 2. Create Android Play Store review test account
DO $$
DECLARE
  v_user_id uuid;
  v_existing uuid;
BEGIN
  SELECT id INTO v_existing FROM auth.users WHERE email = 'androidreview@familialapp.com';
  IF v_existing IS NOT NULL THEN
    RAISE NOTICE 'androidreview@familialapp.com already exists: %', v_existing;
    RETURN;
  END IF;

  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated', 'authenticated',
    'androidreview@familialapp.com',
    crypt('Famil!alAndroid2026', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Android Reviewer"}'::jsonb,
    now(), now(), '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', 'androidreview@familialapp.com'),
    'email', v_user_id::text,
    now(), now(), now()
  );
END $$;
