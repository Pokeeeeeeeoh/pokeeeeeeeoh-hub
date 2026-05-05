
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'send-appointment-reminders-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url:='https://wtrmrhfjrxdfkqpxteuq.supabase.co/functions/v1/send-appointment-reminders',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0cm1yaGZqcnhkZmtxcHh0ZXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxODg0MzcsImV4cCI6MjA4NDc2NDQzN30.f26_D1EHJLYVtVNdhguGwLKDuXF0nOgGKrfRxxeSx_Y"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
