
-- 1) CRITICAL: lock down booking_requests public SELECT (was USING true → leaked all client form data)
DROP POLICY IF EXISTS "Clients can view their own requests via token" ON public.booking_requests;

-- Token-scoped lookup via SECURITY DEFINER RPC. Returns ONLY the row matching the token.
CREATE OR REPLACE FUNCTION public.get_booking_by_token(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.get_booking_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booking_by_token(uuid) TO anon, authenticated;

-- 2) appointments: remove public INSERT. The book-slot edge function uses the service role
--    (which bypasses RLS) and admins are authenticated, so no legitimate flow needs anon INSERT.
DROP POLICY IF EXISTS "Anyone can create appointment" ON public.appointments;

CREATE POLICY "Admins can create appointments"
ON public.appointments
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- 3) email_log: remove public INSERT. Only edge functions (service role) write to it.
DROP POLICY IF EXISTS "Anyone can insert email log" ON public.email_log;

-- 4) Tighten booking_requests INSERT: still public (anonymous booking form needs it)
--    but require the row to start in 'new' status and have empty admin fields, so
--    nobody can self-approve a request directly from the client.
DROP POLICY IF EXISTS "Anyone can create a booking request" ON public.booking_requests;

CREATE POLICY "Anyone can submit a new booking request"
ON public.booking_requests
FOR INSERT
TO public
WITH CHECK (
  status = 'new'::request_status
  AND admin_notes IS NULL
  AND decline_reason IS NULL
);
