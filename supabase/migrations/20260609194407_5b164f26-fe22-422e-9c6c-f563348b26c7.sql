DO $$
DECLARE
  v_url text;
  v_key text;
  rec record;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets
    WHERE name IN ('SUPABASE_URL','project_url','supabase_url') ORDER BY name LIMIT 1;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets
    WHERE name IN ('SUPABASE_SERVICE_ROLE_KEY','service_role_key','email_queue_service_role_key') ORDER BY name LIMIT 1;

  IF v_url IS NULL THEN v_url := 'https://qxkwxolssapayqyfdwqc.supabase.co'; END IF;
  IF v_key IS NULL THEN RAISE EXCEPTION 'No service role secret found in vault'; END IF;

  FOR rec IN
    SELECT * FROM (VALUES
      ('haleymliming@gmail.com','Haley'),
      ('brycehammaz@gmail.com','Bryce'),
      ('brettbradley007@gmail.com','Brett'),
      ('autumnfhopkins@gmail.com','Autumn'),
      ('jcmoon03@gmail.com','Jacob'),
      ('jacohart55@gmail.com','Jacob'),
      ('jacobbozeman4279@gmail.com','Jacob'),
      ('jegar2810@gmail.com','Jesus'),
      ('jonanjsmith@gmail.com','Jonan'),
      ('briana.ede123@gmail.com','Briana'),
      ('bmurray@crossroadschurch.net','Briana'),
      ('carsondimaria@gmail.com','Carson'),
      ('lukejohnson1022@gmail.com','Luke'),
      ('ronald.henely@gmail.com','Ronald'),
      ('nate@vault.email','Nathaniel'),
      ('jpaugh8888@aol.com','Josh'),
      ('bnsbrooke@gmail.com','Brooke'),
      ('kartchnerjohn@gmail.com','John'),
      ('joe.mcglinchey3@gmail.com','Joey')
    ) AS t(email, name)
  LOOP
    PERFORM net.http_post(
      url := v_url || '/functions/v1/send-transactional-email',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer ' || v_key,
        'apikey', v_key
      ),
      body := jsonb_build_object(
        'templateName','founder-gift',
        'recipientEmail', rec.email,
        'idempotencyKey','founder-gift-resend-20260609-' || rec.email,
        'templateData', jsonb_build_object('name', rec.name)
      )
    );
  END LOOP;
END $$;