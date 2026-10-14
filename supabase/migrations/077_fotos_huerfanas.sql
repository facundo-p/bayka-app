-- Fotos de árbol en Storage que ningún árbol usa y nadie anotó para borrar (#806).
--
-- Con el path por subida (075) el móvil sube el archivo antes de `sync_subgroup`.
-- Si el RPC lo rechaza para siempre o el móvil descarta el grupo, el archivo queda
-- sin árbol y sin fila en `fotos_quitadas`. La acción `limpiarFotosQuitadas` de
-- `admin-plantaciones` ahora también borra estos, pasado un plazo de gracia.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS "public"."fotos_huerfanas_por_limpiar"(integer);
--   DROP FUNCTION IF EXISTS "public"."fotos_huerfanas_antiguedad_minima"();
-- No hay columnas ni datos que deshacer. En el repo, el rollback borra también
-- el test 60 y vuelve la edge function a la versión sin `fotosHuerfanasPorLimpiar`.

-- Antigüedad mínima para borrar un archivo sin árbol: cubre una subida en curso y
-- un reintento de sync tardío (cada reintento vuelve a subir y renueva la fecha).
CREATE OR REPLACE FUNCTION "public"."fotos_huerfanas_antiguedad_minima"() RETURNS interval
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT interval '30 days';
$$;

ALTER FUNCTION "public"."fotos_huerfanas_antiguedad_minima"() OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."fotos_huerfanas_antiguedad_minima"() FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."fotos_huerfanas_antiguedad_minima"() TO "service_role";

-- Objetos de `tree-photos` con nombre de foto de árbol que ningún `foto_url`
-- referencia, sin quitada pendiente (esos los borra `fotos_quitadas_por_limpiar`)
-- y sin escribir dentro del plazo. Sin fecha no se devuelve. Un reintento que
-- reescribe el archivo entre esta consulta y el borrado lo perdería, igual que
-- en `fotos_quitadas_por_limpiar`; el cron corre de madrugada.
CREATE OR REPLACE FUNCTION "public"."fotos_huerfanas_por_limpiar"("p_limite" integer)
RETURNS TABLE ("storage_path" "text")
LANGUAGE "sql" STABLE SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
  SELECT o.name
  FROM storage.objects o
  WHERE o.bucket_id = 'tree-photos'
    AND arbol_de_foto(o.name) IS NOT NULL
    AND GREATEST(o.created_at, o.updated_at) < now() - fotos_huerfanas_antiguedad_minima()
    AND NOT EXISTS (
      SELECT 1 FROM trees t
      WHERE path_foto_storage(t.foto_url) = o.name
    )
    AND NOT EXISTS (
      SELECT 1 FROM fotos_quitadas fq
      WHERE fq.storage_path = o.name
        AND fq.limpiada_en IS NULL
    )
  ORDER BY o.name
  LIMIT p_limite;
$$;

ALTER FUNCTION "public"."fotos_huerfanas_por_limpiar"(integer) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."fotos_huerfanas_por_limpiar"(integer) FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."fotos_huerfanas_por_limpiar"(integer) TO "service_role";
