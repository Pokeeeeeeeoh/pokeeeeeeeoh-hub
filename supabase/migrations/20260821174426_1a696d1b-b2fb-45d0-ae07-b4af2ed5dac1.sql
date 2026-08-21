REVOKE ALL ON public.google_calendar_deletion_queue FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.google_calendar_deletion_queue TO service_role;