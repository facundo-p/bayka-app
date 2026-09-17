-- Borrado de fotos de árboles scoped por plantación (#481). Hasta acá la policy
-- de DELETE solo exigía is_admin(): un admin podía borrar fotos de plantaciones
-- de otra organización. Ahora exige además membresía, como INSERT/SELECT/UPDATE
-- (033). Los admin son miembros de las plantaciones de su organización por
-- trigger, así que no pierden nada legítimo.
--
-- El regex se repite dentro del CASE: Postgres no garantiza cortocircuito en AND,
-- y castear a uuid un path malformado tiraría excepción en vez de no matchear.

DROP POLICY IF EXISTS "Admins can delete tree photos" ON storage.objects;
CREATE POLICY "Admins can delete tree photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'tree-photos'
  AND (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND is_admin()
  AND is_plantation_member((CASE WHEN (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN (storage.foldername(name))[2] ELSE NULL END)::uuid)
);
