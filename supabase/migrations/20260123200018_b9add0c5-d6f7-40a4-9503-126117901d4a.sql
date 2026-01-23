-- Create site_settings table for homepage and general site configuration
CREATE TABLE public.site_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_name text NOT NULL DEFAULT 'pokeeeeeeeoh',
  tagline text NOT NULL DEFAULT 'Tattoo artist at Something Tattoo, Malmö',
  email text NOT NULL DEFAULT 'pokeeeeeeeoh@gmail.com',
  address text NOT NULL DEFAULT 'Something Tattoo · Amiralsgatan 10 · Malmö',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read site settings (public homepage)
CREATE POLICY "Anyone can view site settings"
ON public.site_settings
FOR SELECT
USING (true);

-- Only admins can update site settings
CREATE POLICY "Admins can update site settings"
ON public.site_settings
FOR UPDATE
USING (is_admin(auth.uid()));

-- Insert default row
INSERT INTO public.site_settings (site_name, tagline, email, address)
VALUES ('pokeeeeeeeoh', 'Tattoo artist at Something Tattoo, Malmö', 'pokeeeeeeeoh@gmail.com', 'Something Tattoo · Amiralsgatan 10 · Malmö');

-- Add trigger for updated_at
CREATE TRIGGER update_site_settings_updated_at
BEFORE UPDATE ON public.site_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();