CREATE POLICY "Admins can insert booking requests"
ON public.booking_requests
FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));