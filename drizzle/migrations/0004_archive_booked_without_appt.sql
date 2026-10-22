CREATE OR REPLACE FUNCTION public.archive_past_bookings()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.booking_requests br
  SET archived_at = now()
  WHERE br.archived_at IS NULL
    AND (
      br.status = 'declined'
      OR (br.status IN ('booked','completed')
        AND NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.booking_request_id = br.id AND a.end_time > now())
        AND (EXISTS (SELECT 1 FROM public.appointments a WHERE a.booking_request_id = br.id)
             OR br.created_at < now() - interval '1 day'))
    );
$$;
REVOKE ALL ON FUNCTION public.archive_past_bookings() FROM PUBLIC, anon, authenticated;