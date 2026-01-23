-- Create storage bucket for booking images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'booking-images', 
  'booking-images', 
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
);

-- Allow anyone to upload to booking-images bucket
CREATE POLICY "Anyone can upload booking images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'booking-images');

-- Allow public read access
CREATE POLICY "Public read access for booking images"
ON storage.objects FOR SELECT
USING (bucket_id = 'booking-images');

-- Allow admins to delete
CREATE POLICY "Admins can delete booking images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'booking-images' AND public.is_admin(auth.uid()));