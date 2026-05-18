-- 1) Move google_calendar_id out of publicly-readable site_settings
CREATE TABLE IF NOT EXISTS public.admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_calendar_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view admin settings"
  ON public.admin_settings FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update admin settings"
  ON public.admin_settings FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert admin settings"
  ON public.admin_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- Copy existing calendar id over, then drop column from public table
INSERT INTO public.admin_settings (google_calendar_id)
SELECT google_calendar_id FROM public.site_settings
WHERE google_calendar_id IS NOT NULL
LIMIT 1;

ALTER TABLE public.site_settings DROP COLUMN IF EXISTS google_calendar_id;

-- 2) Hide blocked/booked slots from the public; admins still see everything
DROP POLICY IF EXISTS "Anyone can view available slots" ON public.availability_slots;

CREATE POLICY "Public can view only open slots"
  ON public.availability_slots FOR SELECT TO public
  USING (is_booked = false AND is_blocked = false);

-- 3) Lock down email_templates: only admins can read (edge funcs use service role and bypass RLS)
DROP POLICY IF EXISTS "Anyone can view email templates" ON public.email_templates;

CREATE POLICY "Admins can view email templates"
  ON public.email_templates FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- 4) Restrict booking-images bucket: image mime types only, 8 MB max
UPDATE storage.buckets
SET file_size_limit = 8388608,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
WHERE id = 'booking-images';