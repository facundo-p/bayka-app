-- Subir o reemplazar fotos de árboles exige que la plantación del path sea
-- escribible (#512). Hasta acá bastaba la membresía: con la plantación finalizada
-- o archivada la foto llegaba igual a Storage, y después el RPC o el UPDATE de
-- trees rechazaban el dato y el archivo quedaba huérfano, re-subido en cada sync.
--
-- Misma regla que las tablas: un superadmin sí escribe sobre una finalizada, y
-- nadie sobre una archivada. La lectura no cambia. DELETE es de #481.
--
-- El móvil sube con upsert, que pasa por INSERT y UPDATE: van las dos.

DROP POLICY IF EXISTS "Members can upload tree photos" ON storage.objects;
CREATE POLICY "Members can upload tree photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tree-photos'
  AND (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND is_plantation_member((CASE WHEN (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN (storage.foldername(name))[2] ELSE NULL END)::uuid)
  AND plantacion_escribible((CASE WHEN (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN (storage.foldername(name))[2] ELSE NULL END)::uuid)
);

DROP POLICY IF EXISTS "Members can update tree photos" ON storage.objects;
CREATE POLICY "Members can update tree photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tree-photos'
  AND (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND is_plantation_member((CASE WHEN (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN (storage.foldername(name))[2] ELSE NULL END)::uuid)
  AND plantacion_escribible((CASE WHEN (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN (storage.foldername(name))[2] ELSE NULL END)::uuid)
);
