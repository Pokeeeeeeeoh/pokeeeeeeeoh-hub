ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS attention_note text;
GRANT DELETE ON public.booking_requests TO authenticated;
CREATE POLICY "Admins can delete booking requests" ON public.booking_requests FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));