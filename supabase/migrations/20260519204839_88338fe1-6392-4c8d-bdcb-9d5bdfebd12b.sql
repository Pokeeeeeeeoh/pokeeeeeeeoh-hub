-- =====================================================================
-- Security hardening: tighten GRANTs on tables and SECURITY DEFINER funcs
-- =====================================================================
-- Public/anon should only be able to:
--   * INSERT into clients, booking_requests (public booking flow)
--   * SELECT availability_slots (filtered by RLS to open slots only)
--   * SELECT form_config, site_settings, ui_text (public site content)
--   * Call helper RPCs: is_valid_booking_link_key, upsert_client_for_booking,
--     get_booking_by_token
-- Everything else is admin/service-role only.
-- =====================================================================

-- --- Admin-only tables: revoke from anon (authenticated keeps access via RLS) ---
REVOKE ALL ON TABLE public.admin_users           FROM anon;
REVOKE ALL ON TABLE public.admin_settings        FROM anon;
REVOKE ALL ON TABLE public.appointments          FROM anon;
REVOKE ALL ON TABLE public.availability_rules    FROM anon;
REVOKE ALL ON TABLE public.email_log             FROM anon, authenticated;
REVOKE ALL ON TABLE public.email_send_log        FROM anon, authenticated;
REVOKE ALL ON TABLE public.email_send_state      FROM anon, authenticated;
REVOKE ALL ON TABLE public.email_templates       FROM anon;
REVOKE ALL ON TABLE public.email_unsubscribe_tokens FROM anon, authenticated;
REVOKE ALL ON TABLE public.suppressed_emails     FROM anon, authenticated;
REVOKE ALL ON TABLE public.booking_attempts      FROM anon, authenticated;

-- --- Mixed-access tables ---
-- clients: anon may INSERT only
REVOKE ALL ON TABLE public.clients FROM anon;
GRANT INSERT ON TABLE public.clients TO anon;

-- booking_requests: anon may INSERT only
REVOKE ALL ON TABLE public.booking_requests FROM anon;
GRANT INSERT ON TABLE public.booking_requests TO anon;

-- availability_slots: anon may SELECT (RLS filters), nothing else
REVOKE ALL ON TABLE public.availability_slots FROM anon;
GRANT SELECT ON TABLE public.availability_slots TO anon;

-- form_config, site_settings, ui_text: public read stays
-- (default grants are fine; nothing to change)

-- =====================================================================
-- SECURITY DEFINER functions: revoke broad EXECUTE, then grant narrowly
-- =====================================================================

-- Internal email queue helpers — service role only
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb)   FROM PUBLIC, anon, authenticated;

-- Trigger-only helper — no callers needed
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Admin check — used inside RLS via SECURITY DEFINER; no direct callers
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;

-- Public booking helpers — anon must keep EXECUTE
-- (no revoke; just ensure grants are explicit)
GRANT EXECUTE ON FUNCTION public.is_valid_booking_link_key(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_client_for_booking(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_booking_by_token(uuid) TO anon, authenticated;
