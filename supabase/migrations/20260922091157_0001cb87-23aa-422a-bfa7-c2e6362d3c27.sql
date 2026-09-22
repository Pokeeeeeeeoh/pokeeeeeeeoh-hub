CREATE OR REPLACE FUNCTION public.dispatch_appointment_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  svc_key text;
BEGIN
  SELECT decrypted_secret INTO svc_key FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;
  IF svc_key IS NULL THEN
    RAISE WARNING 'appointment reminder dispatch skipped: credential missing';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://wtrmrhfjrxdfkqpxteuq.supabase.co/functions/v1/send-appointment-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || svc_key,
      'X-Internal-Service-Key', svc_key
    ),
    body := '{}'::jsonb
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.dispatch_appointment_reminders() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule('send-appointment-reminders-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'send-appointment-reminders-hourly',
  '0 * * * *',
  $$ SELECT public.dispatch_appointment_reminders(); $$
);