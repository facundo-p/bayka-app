-- Storage bucket 'tree-photos' must be created via Supabase Dashboard BEFORE running this migration.
-- Dashboard -> Storage -> New bucket -> Name: tree-photos, Public: OFF

-- Allow authenticated users to upload photos
CREATE POLICY "Authenticated users can upload tree photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tree-photos'
  AND auth.uid() IS NOT NULL
);

-- Allow authenticated users to read photos (for signed URL access)
CREATE POLICY "Authenticated users can read tree photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'tree-photos'
  AND auth.uid() IS NOT NULL
);

-- Allow authenticated users to overwrite their uploads (upsert support)
CREATE POLICY "Authenticated users can update tree photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tree-photos'
  AND auth.uid() IS NOT NULL
);
