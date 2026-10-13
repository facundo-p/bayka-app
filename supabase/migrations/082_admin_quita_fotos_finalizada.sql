-- Un admin también quita fotos en una plantación finalizada (#903).
--
-- La web ofrece eliminar la foto de un árbol, y Facu decidió que el admin pueda
-- hacerlo aunque la plantación esté finalizada. La excepción es solo para quitar
-- fotos: `puede_editar_finalizada` no cambia, así que el resto de la finalizada
-- sigue siendo solo del superadmin. Una archivada no admite a nadie.
--
-- El resto de `quitar_fotos_arboles` queda igual a 076: miembro, grupo ajeno
-- solo admin y la base que conserva una foto que cambió.
--
-- Rollback:
--   volver a correr `quitar_fotos_arboles` de 076 y
--   DROP FUNCTION IF EXISTS "public"."puede_quitar_fotos_de_plantacion"("uuid");
-- No hay columnas ni datos que deshacer. En el repo, el rollback borra también
-- el test 64.

CREATE OR REPLACE FUNCTION "public"."puede_quitar_fotos_de_plantacion"("p_plantation_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT motivo IS NULL OR (motivo = 'PLANTACION_FINALIZADA' AND is_admin())
  FROM (SELECT motivo_no_escribible(p_plantation_id) AS motivo) AS m;
$$;

ALTER FUNCTION "public"."puede_quitar_fotos_de_plantacion"("uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."puede_quitar_fotos_de_plantacion"("uuid") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."puede_quitar_fotos_de_plantacion"("uuid") TO "service_role";

CREATE OR REPLACE FUNCTION "public"."quitar_fotos_arboles"("p_arboles" "uuid"[], "p_bases" "jsonb" DEFAULT NULL)
RETURNS "jsonb"
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_quitadas INT := 0;
  v_rechazados UUID[] := '{}';
  v_conservadas JSONB;
BEGIN
  SELECT COALESCE(array_agg(t.id), '{}') INTO v_rechazados
  FROM trees t JOIN groups g ON g.id = t.group_id
  WHERE t.id = ANY(p_arboles)
    AND NOT puede_quitar_fotos_de_plantacion(g.plantation_id);

  WITH con_foto AS (
    SELECT t.id, t.foto_url, g.plantation_id,
           quitar_fotos_foto_difiere(p_bases, t.id, t.foto_url) AS conservar
    FROM trees t JOIN groups g ON g.id = t.group_id
    WHERE t.id = ANY(p_arboles)
      AND t.foto_url IS NOT NULL
      AND is_plantation_member(g.plantation_id)
      AND puede_quitar_fotos_de_plantacion(g.plantation_id)
      AND puede_escribir_grupo(g.id)
    FOR UPDATE OF t
  ), quitadas AS (
    UPDATE trees t
    SET foto_url = NULL
    FROM con_foto q
    WHERE t.id = q.id AND NOT q.conservar
    RETURNING t.id
  ), registradas AS (
    INSERT INTO fotos_quitadas (storage_path, tree_id, plantation_id, quitada_por)
    SELECT path_foto_storage(q.foto_url), q.id, q.plantation_id, auth.uid()
    FROM con_foto q
    WHERE NOT q.conservar
      AND path_foto_storage(q.foto_url) IS NOT NULL
  )
  SELECT (SELECT count(*) FROM quitadas),
         (SELECT coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'foto_url', q.foto_url) ORDER BY q.id), '[]')
            FROM con_foto q WHERE q.conservar)
    INTO v_quitadas, v_conservadas;

  RETURN jsonb_build_object(
    'success', true,
    'quitadas', v_quitadas,
    'rechazados', to_jsonb(v_rechazados),
    'conservados', jsonb_build_object('arboles', v_conservadas)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

ALTER FUNCTION "public"."quitar_fotos_arboles"("uuid"[], "jsonb") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."quitar_fotos_arboles"("uuid"[], "jsonb") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."quitar_fotos_arboles"("uuid"[], "jsonb") TO "authenticated", "service_role";
