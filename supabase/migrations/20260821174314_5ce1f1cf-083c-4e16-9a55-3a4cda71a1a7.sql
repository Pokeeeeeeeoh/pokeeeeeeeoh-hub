ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS google_sync_status text NOT NULL DEFAULT 'pending'
    CHECK (google_sync_status IN ('pending', 'syncing', 'synced', 'failed')),
  ADD COLUMN IF NOT EXISTS google_sync_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS google_sync_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS google_sync_last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS google_sync_error text;

UPDATE public.appointments
SET google_sync_status = CASE WHEN google_event_id IS NULL THEN 'pending' ELSE 'synced' END,
    google_sync_last_success_at = CASE WHEN google_event_id IS NOT NULL THEN now() ELSE NULL END;

CREATE OR REPLACE FUNCTION public.mark_appointment_google_sync_pending()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.start_time IS DISTINCT FROM OLD.start_time OR NEW.end_time IS DISTINCT FROM OLD.end_time THEN
    NEW.google_sync_status := 'pending';
    NEW.google_sync_error := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_google_sync_pending ON public.appointments;
CREATE TRIGGER trg_appointments_google_sync_pending
BEFORE INSERT OR UPDATE OF start_time, end_time ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.mark_appointment_google_sync_pending();

CREATE OR REPLACE FUNCTION public.retry_pending_google_calendar_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  appointment_record record;
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
      AND (
        a.google_event_id IS NULL
        OR a.google_sync_status IN ('pending', 'failed')
      )
      AND (
        a.google_sync_last_attempt_at IS NULL
        OR a.google_sync_last_attempt_at < now() - interval '2 minutes'
      )
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
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object('appointmentId', appointment_record.id)
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.retry_pending_google_calendar_sync() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retry_pending_google_calendar_sync() TO service_role;
REVOKE ALL ON FUNCTION public.mark_appointment_google_sync_pending() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_appointment_google_sync_pending() TO service_role;

DO $$
BEGIN
  PERFORM cron.unschedule('retry-google-calendar-sync');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

SELECT cron.schedule(
  'retry-google-calendar-sync',
  '* * * * *',
  $cron$SELECT public.retry_pending_google_calendar_sync();$cron$
);