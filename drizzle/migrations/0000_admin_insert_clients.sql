GRANT INSERT ON public.clients TO authenticated;
CREATE POLICY "Admins can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));