
CREATE OR REPLACE FUNCTION public.upsert_client_for_booking(
  _email text,
  _name text,
  _phone text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF _email IS NULL OR length(trim(_email)) = 0 THEN
    RAISE EXCEPTION 'Email is required';
  END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  SELECT id INTO _id FROM public.clients WHERE email = _email LIMIT 1;

  IF _id IS NULL THEN
    INSERT INTO public.clients (name, email, phone)
    VALUES (_name, _email, NULLIF(_phone, ''))
    RETURNING id INTO _id;
  ELSE
    UPDATE public.clients
       SET name = _name,
           phone = NULLIF(_phone, ''),
           updated_at = now()
     WHERE id = _id;
  END IF;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_client_for_booking(text, text, text) TO anon, authenticated;
