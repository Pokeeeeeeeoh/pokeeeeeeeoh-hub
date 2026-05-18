
-- Make booking-images bucket private + add size/type limits
UPDATE storage.buckets
SET public = false,
    file_size_limit = 10485760, -- 10 MB
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif','image/gif']
WHERE id = 'booking-images';

-- Replace overly permissive public SELECT policy with admin-only
DROP POLICY IF EXISTS "Public read access for booking images" ON storage.objects;

CREATE POLICY "Admins can read booking images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'booking-images' AND public.is_admin(auth.uid()));

-- Tighten INSERT: require path of form <uuid>/<filename>
DROP POLICY IF EXISTS "Anyone can upload booking images" ON storage.objects;

CREATE POLICY "Anyone can upload booking images to a client folder"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'booking-images'
  AND name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[^/]+$'
);
