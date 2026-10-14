-- `catalogo_conteos` suma también fotos y bytes por plantación (#685).
--
-- El catálogo mobile muestra cuánto pesan las fotos antes de descargarlas. El
-- tamaño sale de `storage.objects.metadata->>'size'`, que Storage guarda para
-- cada objeto: es exacto también para fotos viejas, sin columna nueva ni backfill.
--
-- Cambiar el tipo de retorno obliga a DROP + CREATE. `plantation_id`, `grupos` y
-- `arboles` mantienen nombre y semántica: los APKs en uso leen solo esas.
--
-- Rollback: DROP FUNCTION catalogo_conteos(uuid[]) y recrearla como en 067. Un
-- APK que ya lea `fotos`/`bytes_fotos` sigue cargando el catálogo, sin el peso.
-- En el repo, el rollback borra también el test 51.

DROP FUNCTION IF EXISTS "public"."catalogo_conteos"("uuid"[]);

-- SECURITY INVOKER, como en 067: la policy "Members can read tree photos" deja
-- leer a admin y técnico los objetos de las plantaciones de las que son
-- miembros, la misma regla que la de trees y groups. Así solo suma lo que el
-- usuario puede descargar. El LATERAL con LIMIT 1 busca el objeto por índice
-- solo para árboles con foto (la policy se evalúa por foto, no por objeto del
-- bucket) y no infla `grupos` ni `arboles` aunque haya más de una versión.
-- Un `foto_url` local (`file://`) o sin objeto en Storage no suma. Un `size`
-- ausente o no entero cuenta la foto con 0 bytes en vez de romper el catálogo.
CREATE FUNCTION "public"."catalogo_conteos"("p_ids" "uuid"[])
    RETURNS TABLE(
      "plantation_id" "uuid",
      "grupos" bigint,
      "arboles" bigint,
      "fotos" bigint,
      "bytes_fotos" bigint
    )
    LANGUAGE "sql" STABLE SECURITY INVOKER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    g.plantation_id,
    count(DISTINCT g.id),
    count(t.id),
    count(f.bytes),
    coalesce(sum(f.bytes), 0)::bigint
  FROM groups g
  LEFT JOIN trees t ON t.group_id = g.id
  LEFT JOIN LATERAL (
    SELECT CASE WHEN o.metadata->>'size' ~ '^[0-9]+$'
                THEN (o.metadata->>'size')::bigint ELSE 0 END AS bytes
    FROM storage.objects o
    WHERE t.foto_url IS NOT NULL
      AND o.bucket_id = 'tree-photos'
      AND o.name = path_foto_storage(t.foto_url)
    LIMIT 1
  ) f ON true
  WHERE g.plantation_id = ANY (p_ids)
  GROUP BY g.plantation_id;
$$;

ALTER FUNCTION "public"."catalogo_conteos"("uuid"[]) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."catalogo_conteos"("uuid"[]) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."catalogo_conteos"("uuid"[]) TO "authenticated", "service_role";
