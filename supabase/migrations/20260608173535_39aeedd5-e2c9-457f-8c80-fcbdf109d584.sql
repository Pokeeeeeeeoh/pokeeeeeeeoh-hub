ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS approval_token_expires_at timestamptz;

-- Backfill: existing approved tokens get 14 days from now (or from created_at if newer)
UPDATE public.booking_requests
SET approval_token_expires_at = GREATEST(created_at, now()) + interval '14 days'
WHERE approval_token_expires_at IS NULL;

CREATE OR REPLACE FUNCTION public.get_booking_by_token(_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF _token IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT jsonb_build_object(
    'id', br.id,
    'client_id', br.client_id,
    'status', br.status,
    'client_name', c.name,
    'client_email', c.email,
    'expires_at', br.approval_token_expires_at,
    'expired', (br.approval_token_expires_at IS NOT NULL AND br.approval_token_expires_at < now() AND br.status <> 'booked'),
    'appointment', (
      SELECT jsonb_build_object(
        'slot_id', a.slot_id,
        'start_time', a.start_time,
        'end_time', a.end_time
      )
      FROM public.appointments a
      WHERE a.booking_request_id = br.id
      ORDER BY a.created_at DESC
      LIMIT 1
    )
  )
  INTO result
  FROM public.booking_requests br
  LEFT JOIN public.clients c ON c.id = br.client_id
  WHERE br.approval_token = _token;
  RETURN result;
END;
$function$;