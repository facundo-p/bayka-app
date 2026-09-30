-- Registro de fotos quitadas y su limpieza en Storage (#516).
--
-- `quitar_fotos_arboles` (044) deja `foto_url` en null pero no puede borrar el
-- archivo: un técnico no tiene DELETE en `tree-photos` y borrar la fila de
-- `storage.objects` desde SQL no borra el objeto. Ahora anota cada foto quitada
-- y la edge function `admin-plantaciones` (acción `limpiarFotosQuitadas`, con
-- service_role) borra esos archivos vía Storage API.
--
-- El registro también separa una foto quitada a propósito de una referencia
-- perdida (#491): un árbol con `foto_url` null y objeto en Storage cuyo path está
-- pendiente acá no se repara.

-- ── A. Registro ──────────────────────────────────────────────────────────────

-- Sin FK a trees ni plantations: el registro sobrevive al borrado del árbol o de
-- la plantación, y el archivo sigue en Storage hasta que se limpie.
CREATE TABLE IF NOT EXISTS "public"."fotos_quitadas" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "storage_path" "text" NOT NULL,
  "tree_id" "uuid" NOT NULL,
  "plantation_id" "uuid" NOT NULL,
  "quitada_por" "uuid" REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "quitada_en" timestamp with time zone NOT NULL DEFAULT "now"(),
  "limpiada_en" timestamp with time zone,
  -- borrada: se borró el archivo. reasignada: el path volvió a tener foto antes
  -- de limpiarlo, y el archivo es el nuevo.
  "resultado" "text" CHECK ("resultado" IN ('borrada', 'reasignada')),
  CONSTRAINT "fotos_quitadas_resultado_con_fecha"
    CHECK (("limpiada_en" IS NULL) = ("resultado" IS NULL))
);

ALTER TABLE "public"."fotos_quitadas" OWNER TO "postgres";
ALTER TABLE "public"."fotos_quitadas" ENABLE ROW LEVEL SECURITY;

-- La escribe `quitar_fotos_arboles` (definer) y la procesa service_role.
REVOKE ALL ON TABLE "public"."fotos_quitadas" FROM PUBLIC, "anon", "authenticated";
GRANT ALL ON TABLE "public"."fotos_quitadas" TO "service_role";

CREATE INDEX IF NOT EXISTS "fotos_quitadas_pendientes_idx"
  ON "public"."fotos_quitadas" ("storage_path")
  WHERE "limpiada_en" IS NULL;

-- ── B. Path de Storage de un foto_url ────────────────────────────────────────

-- `foto_url` guarda el path relativo del bucket; filas viejas pueden tener la URL
-- completa (con `?token=…`). Un URI local (`file://`, `content://`) no está en
-- Storage y devuelve null.
CREATE OR REPLACE FUNCTION "public"."path_foto_storage"("p_foto_url" "text")
RETURNS "text"
LANGUAGE "sql" IMMUTABLE
SET "search_path" TO 'public'
AS $$
  SELECT CASE
    WHEN "path" = '' OR "path" LIKE '%://%' THEN NULL
    ELSE "path"
  END
  FROM (
    SELECT split_part(regexp_replace(p_foto_url, '^.*/tree-photos/', ''), '?', 1) AS "path"
  ) AS normalizado;
$$;

ALTER FUNCTION "public"."path_foto_storage"("text") OWNER TO "postgres";

-- ── C. quitar_fotos_arboles anota lo que quita ───────────────────────────────

-- Igual a 044 salvo el registro. El SELECT … FOR UPDATE toma el foto_url previo:
-- el RETURNING del UPDATE ya lo ve en null.
CREATE OR REPLACE FUNCTION "public"."quitar_fotos_arboles"("p_arboles" "uuid"[])
RETURNS "jsonb"
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_quitadas INT := 0;
  v_rechazados UUID[] := '{}';
BEGIN
  -- Rechazados = los que EXISTEN en una plantación no escribible: quedan
  -- pendientes en el device por si se reabre. Mismo criterio que 037.
  SELECT COALESCE(array_agg(t.id), '{}') INTO v_rechazados
  FROM trees t JOIN groups g ON g.id = t.group_id
  WHERE t.id = ANY(p_arboles)
    AND NOT plantacion_escribible(g.plantation_id);

  -- Membresía y estado contra la plantación REAL de cada fila, no la del payload.
  WITH a_quitar AS (
    SELECT t.id, t.foto_url, g.plantation_id
    FROM trees t JOIN groups g ON g.id = t.group_id
    WHERE t.id = ANY(p_arboles)
      AND t.foto_url IS NOT NULL
      AND is_plantation_member(g.plantation_id)
      AND plantacion_escribible(g.plantation_id)
    FOR UPDATE OF t
  ), quitadas AS (
    UPDATE trees t
    SET foto_url = NULL
    FROM a_quitar q
    WHERE t.id = q.id
    RETURNING t.id
  ), registradas AS (
    INSERT INTO fotos_quitadas (storage_path, tree_id, plantation_id, quitada_por)
    SELECT path_foto_storage(q.foto_url), q.id, q.plantation_id, auth.uid()
    FROM a_quitar q
    WHERE path_foto_storage(q.foto_url) IS NOT NULL
  )
  SELECT count(*) INTO v_quitadas FROM quitadas;

  RETURN jsonb_build_object(
    'success', true,
    'quitadas', v_quitadas,
    'rechazados', to_jsonb(v_rechazados)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

ALTER FUNCTION "public"."quitar_fotos_arboles"("uuid"[]) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."quitar_fotos_arboles"("uuid"[]) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."quitar_fotos_arboles"("uuid"[]) TO "authenticated", "service_role";

-- ── D. Limpieza (solo service_role) ──────────────────────────────────────────

-- Antes de devolver las pendientes cierra como `reasignada` las que ya no se
-- pueden borrar: el path vuelve a ser el foto_url de un árbol, o el objeto se
-- reescribió después de quitarla (foto nueva subida, foto_url todavía sin
-- apuntar). Entre esta consulta y el borrado queda una ventana de segundos en
-- la que una subida nueva se perdería; el cron corre de madrugada.
CREATE OR REPLACE FUNCTION "public"."fotos_quitadas_por_limpiar"("p_limite" integer)
RETURNS TABLE ("id" bigint, "storage_path" "text")
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
BEGIN
  UPDATE fotos_quitadas fq
  SET limpiada_en = now(), resultado = 'reasignada'
  WHERE fq.limpiada_en IS NULL
    AND (
      EXISTS (
        SELECT 1 FROM trees t
        WHERE path_foto_storage(t.foto_url) = fq.storage_path
      )
      OR EXISTS (
        SELECT 1 FROM storage.objects o
        WHERE o.bucket_id = 'tree-photos'
          AND o.name = fq.storage_path
          AND GREATEST(o.created_at, o.updated_at) > fq.quitada_en
      )
    );

  RETURN QUERY
  SELECT fq.id, fq.storage_path
  FROM fotos_quitadas fq
  WHERE fq.limpiada_en IS NULL
  ORDER BY fq.id
  LIMIT p_limite;
END;
$$;

ALTER FUNCTION "public"."fotos_quitadas_por_limpiar"(integer) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."fotos_quitadas_por_limpiar"(integer) FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."fotos_quitadas_por_limpiar"(integer) TO "service_role";

-- Cierra todas las pendientes del path, no solo el id: si la foto se quitó dos
-- veces, un solo borrado resuelve las dos filas.
CREATE OR REPLACE FUNCTION "public"."marcar_fotos_quitadas_borradas"("p_ids" bigint[])
RETURNS integer
LANGUAGE "sql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
  WITH borradas AS (
    UPDATE fotos_quitadas
    SET limpiada_en = now(), resultado = 'borrada'
    WHERE limpiada_en IS NULL
      AND storage_path IN (SELECT storage_path FROM fotos_quitadas WHERE id = ANY(p_ids))
    RETURNING 1
  )
  SELECT count(*)::integer FROM borradas;
$$;

ALTER FUNCTION "public"."marcar_fotos_quitadas_borradas"(bigint[]) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."marcar_fotos_quitadas_borradas"(bigint[]) FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."marcar_fotos_quitadas_borradas"(bigint[]) TO "service_role";
