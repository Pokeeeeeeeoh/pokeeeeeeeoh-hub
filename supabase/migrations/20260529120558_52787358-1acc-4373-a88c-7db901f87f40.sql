ALTER TABLE public.form_config ADD COLUMN IF NOT EXISTS aftercare_content TEXT;

UPDATE public.form_config
SET aftercare_content = E'### Aftercare\n\nIf your tattoo was wrapped in a **"sticky plastic" bandage**, these are very good for healing!\n\n1. Leave the bandage on for 24-48 hours\n2. Peel it off gently in the shower with warm water\n3. Wash with mild soap and pat dry\n4. Apply a thin layer of unscented moisturizer 2-3 times a day\n5. Avoid submerging in water (pools, baths) for 2 weeks\n6. Avoid direct sunlight on the fresh tattoo\n\nThe tattoo may look dull during healing — this is normal! It will brighten up once fully healed (usually 2-4 weeks).\n'
WHERE aftercare_content IS NULL;

UPDATE public.form_config
SET info_content = regexp_replace(info_content, E'\\n*---\\n*### Aftercare[\\s\\S]*$', '')
WHERE info_content ~ '### Aftercare';