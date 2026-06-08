
-- 1. Lock down booking-images storage: anonymous uploads now go through the
-- get-booking-upload-urls edge function which uses signed upload URLs.
DROP POLICY IF EXISTS "Anyone can upload booking images to a client folder" ON storage.objects;

-- 2. Remove the always-true public INSERT policies. Public submissions go
-- through the submit-booking-request edge function (service role).
DROP POLICY IF EXISTS "Anyone can create a client" ON public.clients;
DROP POLICY IF EXISTS "Anyone can submit a new booking request" ON public.booking_requests;

-- 3. Add an explicit service-only policy to booking_attempts so it isn't an
-- "RLS enabled, no policy" table. service_role bypasses RLS, but this makes
-- intent explicit and silences the linter.
CREATE POLICY "Service role can manage booking attempts"
  ON public.booking_attempts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 4. Revoke broad anon discoverability on tables that should never appear in
-- the public GraphQL/REST schema. Keep public read on the three settings tables
-- and on availability_slots, which the booking pages legitimately need.
REVOKE ALL ON public.admin_settings        FROM anon;
REVOKE ALL ON public.admin_users           FROM anon;
REVOKE ALL ON public.appointments          FROM anon;
REVOKE ALL ON public.availability_rules    FROM anon;
REVOKE ALL ON public.booking_attempts      FROM anon, authenticated;
REVOKE ALL ON public.booking_requests      FROM anon;
REVOKE ALL ON public.clients               FROM anon;
REVOKE ALL ON public.email_log             FROM anon;
REVOKE ALL ON public.email_send_log        FROM anon, authenticated;
REVOKE ALL ON public.email_send_state      FROM anon, authenticated;
REVOKE ALL ON public.email_templates       FROM anon;
REVOKE ALL ON public.email_unsubscribe_tokens FROM anon, authenticated;
REVOKE ALL ON public.suppressed_emails     FROM anon, authenticated;

-- Make sure the admin-facing tables still work for the signed-in admin client.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_settings     TO authenticated;
GRANT SELECT                          ON public.admin_users       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_requests   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients            TO authenticated;
GRANT SELECT                          ON public.email_log         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates    TO authenticated;

-- service_role keeps full access on everything
GRANT ALL ON public.admin_settings, public.admin_users, public.appointments,
             public.availability_rules, public.booking_attempts,
             public.booking_requests, public.clients, public.email_log,
             public.email_send_log, public.email_send_state,
             public.email_templates, public.email_unsubscribe_tokens,
             public.suppressed_emails
  TO service_role;

-- 5. Revoke EXECUTE on SECURITY DEFINER helper functions from anon/authenticated
-- where only edge functions / service role should call them. is_admin is kept
-- executable because RLS policies depend on it.
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer)        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint)                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb)                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb)           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column()                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_valid_booking_link_key(text)                  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_booking_by_token(uuid)                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_client_for_booking(text, text, text)      FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer)        TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint)                       TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb)                       TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb)           TO service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column()                       TO service_role;
GRANT EXECUTE ON FUNCTION public.is_valid_booking_link_key(text)                  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_booking_by_token(uuid)                       TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_client_for_booking(text, text, text)      TO service_role;
