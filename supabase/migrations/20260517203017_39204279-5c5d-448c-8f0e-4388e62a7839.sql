
ALTER TABLE public.form_config
ADD COLUMN IF NOT EXISTS contact_fields jsonb NOT NULL DEFAULT '{
  "name":  {"label": "Name",  "required": true,  "enabled": true},
  "email": {"label": "Email", "required": true,  "enabled": true},
  "phone": {"label": "Phone", "required": false, "enabled": true}
}'::jsonb;
