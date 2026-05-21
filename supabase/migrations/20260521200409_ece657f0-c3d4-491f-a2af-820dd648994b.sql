-- Schedule daily Enterprise invoice reminder emails to brettbradley007@gmail.com.
-- Runs every day at 14:00 UTC and sends a reminder 7 days before and on the due date.
SELECT cron.schedule(
  'send-invoice-reminders-daily',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url := 'https://qxkwxolssapayqyfdwqc.supabase.co/functions/v1/send-invoice-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);