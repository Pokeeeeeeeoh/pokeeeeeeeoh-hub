INSERT INTO public.admin_users (user_id, email)
SELECT id, email FROM auth.users WHERE email = 'pokeeeeeeeoh@gmail.com'
ON CONFLICT DO NOTHING;