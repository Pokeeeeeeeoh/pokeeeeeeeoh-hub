
-- 1. Add booking_link_key to admin_settings
ALTER TABLE public.admin_settings
ADD COLUMN IF NOT EXISTS booking_link_key text;

-- Seed a key for the existing row if missing
UPDATE public.admin_settings
SET booking_link_key = encode(gen_random_bytes(24), 'hex')
WHERE booking_link_key IS NULL;

-- 2. booking_attempts table for rate limiting
CREATE TABLE IF NOT EXISTS public.booking_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  link_key text,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_attempts_ip_created
  ON public.booking_attempts (ip_hash, created_at DESC);

ALTER TABLE public.booking_attempts ENABLE ROW LEVEL SECURITY;

-- No public policies = only service role can read/write (bypasses RLS).

-- 3. Public RPC to check a key without exposing it
CREATE OR REPLACE FUNCTION public.is_valid_booking_link_key(_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_settings
    WHERE booking_link_key IS NOT NULL
      AND booking_link_key = _key
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_valid_booking_link_key(text) TO anon, authenticated;
