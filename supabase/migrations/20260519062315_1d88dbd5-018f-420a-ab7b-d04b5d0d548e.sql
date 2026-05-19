
-- 1. Notify circle members when a new album is created
CREATE OR REPLACE FUNCTION public.notify_on_album_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_name text;
  v_alias text;
  v_member record;
BEGIN
  SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = NEW.created_by;

  FOR v_member IN
    SELECT cm.user_id FROM circle_memberships cm WHERE cm.circle_id = NEW.circle_id AND cm.user_id <> NEW.created_by
    UNION
    SELECT c.owner_id FROM circles c WHERE c.id = NEW.circle_id AND c.owner_id <> NEW.created_by
  LOOP
    SELECT alias INTO v_alias FROM member_aliases
      WHERE user_id = v_member.user_id AND target_user_id = NEW.created_by LIMIT 1;

    INSERT INTO notifications (user_id, type, title, message, related_circle_id, link)
    VALUES (
      v_member.user_id,
      'new_album',
      'New Album',
      COALESCE(v_alias, v_actor_name, 'Someone') || ' shared a new album: "' || NEW.name || '"',
      NEW.circle_id,
      '/albums?albumId=' || NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_album_created ON public.photo_albums;
CREATE TRIGGER trg_notify_album_created
AFTER INSERT ON public.photo_albums
FOR EACH ROW EXECUTE FUNCTION public.notify_on_album_created();

-- 2. Email dispatcher: fire send-transactional-email for mentions and new albums
CREATE OR REPLACE FUNCTION public.trigger_notification_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_anon_key text;
  v_recipient_email text;
  v_pref_mention boolean;
  v_pref_album boolean;
  v_template text;
  v_actor_name text;
  v_circle_name text;
  v_should_send boolean := false;
BEGIN
  -- Only handle these two types
  IF NEW.type NOT IN ('mention', 'new_album') THEN
    RETURN NEW;
  END IF;

  -- Look up recipient email + preferences
  SELECT au.email, p.email_on_mention, p.email_on_new_album
  INTO v_recipient_email, v_pref_mention, v_pref_album
  FROM auth.users au
  LEFT JOIN profiles p ON p.user_id = au.id
  WHERE au.id = NEW.user_id;

  IF v_recipient_email IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.type = 'mention' AND COALESCE(v_pref_mention, true) THEN
    v_template := 'mention-notification';
    v_should_send := true;
  ELSIF NEW.type = 'new_album' AND COALESCE(v_pref_album, true) THEN
    v_template := 'new-album';
    v_should_send := true;
  END IF;

  IF NOT v_should_send THEN
    RETURN NEW;
  END IF;

  -- Fetch actor & circle names for template data
  IF NEW.related_user_id IS NOT NULL THEN
    SELECT display_name INTO v_actor_name FROM profiles WHERE user_id = NEW.related_user_id;
  END IF;
  IF NEW.related_circle_id IS NOT NULL THEN
    SELECT name INTO v_circle_name FROM circles WHERE id = NEW.related_circle_id;
  END IF;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_anon_key
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;

  IF v_url IS NULL OR v_anon_key IS NULL THEN
    RAISE LOG 'trigger_notification_email: vault secrets missing for notification %', NEW.id;
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := v_url || '/functions/v1/send-transactional-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key,
        'apikey', v_anon_key
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
$$;

DROP TRIGGER IF EXISTS on_notification_insert_email ON public.notifications;
CREATE TRIGGER on_notification_insert_email
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.trigger_notification_email();
