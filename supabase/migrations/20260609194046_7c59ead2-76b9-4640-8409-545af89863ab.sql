DO $$
DECLARE v_url text; v_key text; v_names text;
BEGIN
  SELECT string_agg(name, ', ') INTO v_names FROM vault.decrypted_secrets;
  RAISE NOTICE 'Vault names: %', v_names;

  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets
    WHERE name IN ('SUPABASE_URL','project_url','supabase_url') ORDER BY name LIMIT 1;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets
    WHERE name IN ('SUPABASE_SERVICE_ROLE_KEY','service_role_key','email_queue_service_role_key') ORDER BY name LIMIT 1;

  IF v_url IS NULL THEN v_url := 'https://qxkwxolssapayqyfdwqc.supabase.co'; END IF;
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'No service role secret found in vault. Names were: %', v_names;
  END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/send-transactional-email',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||v_key,
      'apikey', v_key
    ),
    body := jsonb_build_object(
      'templateName','founder-gift',
      'recipientEmail','gaylabrum@aol.com',
      'templateData', jsonb_build_object('name','Gayla'),
      'idempotencyKey','founder-gift-07b2d321-f751-46ea-beeb-92bdc784b6cc-resend-2026-06-09'
    )
  );
  RAISE NOTICE 'Email re-send request posted to send-transactional-email';
END $$;