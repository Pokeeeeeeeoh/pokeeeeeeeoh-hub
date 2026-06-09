GRANT EXECUTE ON FUNCTION public.is_valid_booking_link_key(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_booking_by_token(uuid) TO anon, authenticated;
GRANT SELECT ON public.availability_slots TO anon, authenticated;