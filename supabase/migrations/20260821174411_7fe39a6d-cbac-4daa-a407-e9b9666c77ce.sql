CREATE TABLE public.google_calendar_deletion_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_event_id text NOT NULL UNIQUE,
  attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.google_calendar_deletion_queue TO service_role;
ALTER TABLE public.google_calendar_deletion_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages Google deletion queue"
ON public.google_calendar_deletion_queue
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.queue_appointment_google_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.google_event_id IS NOT NULL THEN
    INSERT INTO public.google_calendar_deletion_queue (google_event_id)
    VALUES (OLD.google_event_id)
    ON CONFLICT (google_event_id) DO NOTHING;
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_appointment_google_deletion() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_appointment_google_deletion() TO service_role;

DROP TRIGGER IF EXISTS trg_queue_appointment_google_deletion ON public.appointments;
CREATE TRIGGER trg_queue_appointment_google_deletion
BEFORE DELETE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.queue_appointment_google_deletion();

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
BEGIN
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key'
  LIMIT 1;

  IF service_key IS NULL THEN
    RAISE WARNING 'Google Calendar retry skipped: internal service credential missing';
    RETURN;
  END IF;

  FOR appointment_record IN
    SELECT a.id
    FROM public.appointments a
    JOIN public.booking_requests br ON br.id = a.booking_request_id
    WHERE br.status = 'booked'
      AND a.start_time >= now() - interval '1 day'
      AND (a.google_event_id IS NULL OR a.google_sync_status IN ('pending', 'failed'))
      AND (a.google_sync_last_attempt_at IS NULL OR a.google_sync_last_attempt_at < now() - interval '2 minutes')
    ORDER BY a.start_time
    LIMIT 25
    FOR UPDATE OF a SKIP LOCKED
  LOOP
    UPDATE public.appointments
    SET google_sync_status = 'syncing',
        google_sync_attempts = google_sync_attempts + 1,
        google_sync_last_attempt_at = now()
    WHERE id = appointment_record.id;

    PERFORM net.http_post(
      url := 'https://wtrmrhfjrxdfkqpxteuq.supabase.co/functions/v1/sync-gcal-event',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
      body := jsonb_build_object('appointmentId', appointment_record.id)
    );
  END LOOP;

  FOR deletion_record IN
    SELECT q.id, q.google_event_id
    FROM public.google_calendar_deletion_queue q
    WHERE q.last_attempt_at IS NULL OR q.last_attempt_at < now() - interval '2 minutes'
    ORDER BY q.created_at
    LIMIT 25
    FOR UPDATE OF q SKIP LOCKED
  LOOP
    UPDATE public.google_calendar_deletion_queue
    SET attempts = attempts + 1, last_attempt_at = now()
    WHERE id = deletion_record.id;

    PERFORM net.http_post(
      url := 'https://wtrmrhfjrxdfkqpxteuq.supabase.co/functions/v1/sync-gcal-event',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
      body := jsonb_build_object('action', 'delete', 'googleEventId', deletion_record.google_event_id)
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.retry_pending_google_calendar_sync() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retry_pending_google_calendar_sync() TO service_role;