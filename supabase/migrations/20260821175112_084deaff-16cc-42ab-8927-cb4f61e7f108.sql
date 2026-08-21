SELECT vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0cm1yaGZqcnhkZmtxcHh0ZXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxODg0MzcsImV4cCI6MjA4NDc2NDQzN30.f26_D1EHJLYVtVNdhguGwLKDuXF0nOgGKrfRxxeSx_Y',
  'google_calendar_gateway_anon_key',
  'Public gateway credential for durable Google Calendar retry worker'
)
WHERE NOT EXISTS (
  SELECT 1 FROM vault.secrets WHERE name = 'google_calendar_gateway_anon_key'
);

CREATE OR REPLACE FUNCTION public.retry_pending_google_calendar_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  appointment_record record;
  deletion_record record;
  service_key text;
  gateway_key text;
BEGIN
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;
  SELECT decrypted_secret INTO gateway_key FROM vault.decrypted_secrets WHERE name = 'google_calendar_gateway_anon_key' LIMIT 1;

  IF service_key IS NULL OR gateway_key IS NULL THEN
    RAISE WARNING 'Google Calendar retry skipped: internal credentials missing';
    RETURN;
  END IF;

  FOR appointment_record IN
    SELECT a.id
    FROM public.appointments a
    JOIN public.booking_requests br ON br.id = a.booking_request_id
    WHERE br.status = 'booked'
      AND a.start_time >= now() - interval '1 day'
      AND (a.google_event_id IS NULL OR a.google_sync_status IN ('pending', 'failed', 'syncing'))
      AND (a.google_sync_last_attempt_at IS NULL OR a.google_sync_last_attempt_at < now() - interval '2 minutes')
    ORDER BY a.start_time LIMIT 25 FOR UPDATE OF a SKIP LOCKED
  LOOP
    UPDATE public.appointments
    SET google_sync_status = 'syncing', google_sync_attempts = google_sync_attempts + 1, google_sync_last_attempt_at = now()
    WHERE id = appointment_record.id;
    PERFORM net.http_post(
      url := 'https://wtrmrhfjrxdfkqpxteuq.supabase.co/functions/v1/sync-gcal-event',
      headers := jsonb_build_object('Content-Type','application/json','apikey',gateway_key,'Authorization','Bearer '||gateway_key,'X-Internal-Service-Key',service_key),
      body := jsonb_build_object('appointmentId',appointment_record.id)
    );
  END LOOP;

  FOR deletion_record IN
    SELECT q.id, q.google_event_id FROM public.google_calendar_deletion_queue q
    WHERE q.last_attempt_at IS NULL OR q.last_attempt_at < now() - interval '2 minutes'
    ORDER BY q.created_at LIMIT 25 FOR UPDATE OF q SKIP LOCKED
  LOOP
    UPDATE public.google_calendar_deletion_queue SET attempts=attempts+1,last_attempt_at=now() WHERE id=deletion_record.id;
    PERFORM net.http_post(
      url := 'https://wtrmrhfjrxdfkqpxteuq.supabase.co/functions/v1/sync-gcal-event',
      headers := jsonb_build_object('Content-Type','application/json','apikey',gateway_key,'Authorization','Bearer '||gateway_key,'X-Internal-Service-Key',service_key),
      body := jsonb_build_object('action','delete','googleEventId',deletion_record.google_event_id)
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.retry_pending_google_calendar_sync() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retry_pending_google_calendar_sync() TO service_role;