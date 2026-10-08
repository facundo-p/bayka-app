-- `quitar_fotos_arboles` no quita una foto que cambió en el servidor desde que el
-- móvil la vio (#810).
--
-- Era el único dato de #795 donde ganaba la última sincronización: si otro
-- celular o la web subió una foto nueva, quitar la del móvil la borraba igual.
-- Ahora el móvil manda, por árbol, el `foto_url` que vio (`p_bases`, `{id: foto_url
-- o null}`). Si el servidor tiene otra, no la quita y la devuelve en
-- `conservados.arboles`, con la forma de `sync_subgroup` (075); el móvil la adopta
-- y guarda el quitado como conflicto.
--
-- Un árbol sin base se quita como antes: el APK de prod manda solo `p_arboles`.
-- Sigue igual a 072 en lo demás: miembro, plantación escribible y, en un grupo
-- ajeno, solo admin.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS "public"."quitar_fotos_arboles"("uuid"[], "jsonb");
--   DROP FUNCTION IF EXISTS "public"."quitar_fotos_foto_difiere"("jsonb", "uuid", "text");
-- y volver a correr `quitar_fotos_arboles` de 072. No hay columnas ni datos que
-- deshacer. En el repo, el rollback borra también el test 59 y vuelve la firma
-- del test 22.

-- La foto del servidor no es la que el móvil vio al quitarla. Sin base para el
-- árbol, no difiere.
CREATE OR REPLACE FUNCTION "public"."quitar_fotos_foto_difiere"("p_bases" "jsonb", "p_arbol" "uuid", "p_foto_url" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT coalesce(jsonb_typeof(p_bases) = 'object'
                  AND p_bases ? p_arbol::text
                  AND p_foto_url IS DISTINCT FROM p_bases->>p_arbol::text, false);
$$;

ALTER FUNCTION "public"."quitar_fotos_foto_difiere"("jsonb", "uuid", "text") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."quitar_fotos_foto_difiere"("jsonb", "uuid", "text") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."quitar_fotos_foto_difiere"("jsonb", "uuid", "text") TO "service_role";

-- Cambia la firma: con las dos, PostgREST no sabría cuál llamar con solo `p_arboles`.
DROP FUNCTION IF EXISTS "public"."quitar_fotos_arboles"("uuid"[]);

CREATE FUNCTION "public"."quitar_fotos_arboles"("p_arboles" "uuid"[], "p_bases" "jsonb" DEFAULT NULL)
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
    AND NOT plantacion_escribible(g.plantation_id);

  WITH con_foto AS (
    SELECT t.id, t.foto_url, g.plantation_id,
           quitar_fotos_foto_difiere(p_bases, t.id, t.foto_url) AS conservar
    FROM trees t JOIN groups g ON g.id = t.group_id
    WHERE t.id = ANY(p_arboles)
      AND t.foto_url IS NOT NULL
      AND is_plantation_member(g.plantation_id)
      AND plantacion_escribible(g.plantation_id)
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
