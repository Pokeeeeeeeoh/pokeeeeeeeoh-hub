ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS google_calendar_id TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS google_event_id TEXT;