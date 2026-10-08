-- `sync_subgroup` no pisa GPS, foto ni datos del grupo que cambiaron en el
-- servidor desde que el móvil los vio (#795, #802).
--
-- Hasta acá ganaba la última sincronización: el GPS, la foto y el nombre, código,
-- tipo y estado del grupo quedaban con lo que mandaba el móvil, aunque fuera una
-- copia vieja. La especie ya tenía base (065). Ahora el móvil manda la base de
-- cada dato y, si el servidor ya tiene otra, conserva la suya y la devuelve en
-- `conservados`; el móvil la adopta y, si también la había cambiado, guarda la
-- suya como conflicto para que la persona decida.
--
-- - Grupo: `base` = {nombre, codigo, tipo, estado}.
-- - Árbol: `gps_base` = {latitude, longitude, gps_captured_at} o null, y
--   `foto_base` = el `foto_url` que vio, o null.
--
-- Sin la clave, el móvil pisa como antes: el APK de prod no las manda.
--
-- La foto pasa a un path por subida (`<id del árbol>-<versión>.jpg`): `foto_url`
-- sirve de base y una subida no pisa el archivo de otro. La que pierde y la que
-- queda reemplazada se anotan en `fotos_quitadas` para que las borre el cron.
--
-- Partes nuevas: `conservar_grupo`, `conservar_fotos_y_gps`, `foto_difiere`,
-- `gps_difiere`, `anotar_fotos_descartadas` y `conservados`. Redefine
-- `upsert_arboles` (SubID con el código de grupo vigente), la orquestadora y
-- `arbol_de_foto`.
--
-- Rollback: volver a correr `arbol_de_foto` de 072, `sync_subgroup_upsert_arboles`
-- de 066 y la orquestadora de 065, y después
--   DROP FUNCTION IF EXISTS "public"."sync_subgroup_conservados"("jsonb", "jsonb", "jsonb");
--   DROP FUNCTION IF EXISTS "public"."sync_subgroup_anotar_fotos_descartadas"("jsonb", "jsonb", "jsonb");
--   DROP FUNCTION IF EXISTS "public"."sync_subgroup_conservar_fotos_y_gps"("jsonb");
--   DROP FUNCTION IF EXISTS "public"."sync_subgroup_gps_difiere"("jsonb", double precision, double precision, timestamp with time zone);
--   DROP FUNCTION IF EXISTS "public"."sync_subgroup_foto_difiere"("jsonb", "text");
--   DROP FUNCTION IF EXISTS "public"."sync_subgroup_conservar_grupo"("jsonb");
-- No hay columnas ni datos que deshacer. En el repo, el rollback borra también el
-- test 58 y saca las partes nuevas del test 45.

-- ── A. Foto con versión ──────────────────────────────────────────────────────

-- Igual a 072, con el sufijo de versión opcional: las policies de Storage siguen
-- encontrando el árbol en un path versionado.
CREATE OR REPLACE FUNCTION "public"."arbol_de_foto"("p_name" "text") RETURNS "uuid"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT substring(p_name FROM '(?:^|/)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:-[0-9A-Za-z]+)?\.[^/]*$')::uuid;
$$;

-- ── B. Grupo ─────────────────────────────────────────────────────────────────

-- El grupo a subir, con el valor del servidor en cada campo que difiere de la
-- base. Va antes del rechazo: un código o nombre viejo que el servidor conserva
-- no cuenta como duplicado. FOR UPDATE antes de comparar, y es el primer lock de
-- la orquestadora.
CREATE OR REPLACE FUNCTION "public"."sync_subgroup_conservar_grupo"("p_subgroup" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actual JSONB;
BEGIN
  IF jsonb_typeof(p_subgroup->'base') IS DISTINCT FROM 'object' THEN
    RETURN p_subgroup;
  END IF;

  SELECT to_jsonb(g) INTO v_actual FROM groups g WHERE id = (p_subgroup->>'id')::UUID FOR UPDATE;
  IF v_actual IS NULL THEN
    RETURN p_subgroup;
  END IF;

  RETURN p_subgroup || (
    SELECT coalesce(jsonb_object_agg(c.campo, v_actual->c.campo), '{}')
      FROM unnest(ARRAY['nombre', 'codigo', 'tipo', 'estado']) AS c(campo)
     WHERE v_actual->>c.campo IS DISTINCT FROM p_subgroup->'base'->>c.campo
  );
END;
$$;

ALTER FUNCTION "public"."sync_subgroup_conservar_grupo"("jsonb") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."sync_subgroup_conservar_grupo"("jsonb") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."sync_subgroup_conservar_grupo"("jsonb") TO "service_role";

-- ── C. Foto y GPS ────────────────────────────────────────────────────────────

-- La foto del servidor no es la que el móvil vio. Sin `foto_base`, nunca.
CREATE OR REPLACE FUNCTION "public"."sync_subgroup_foto_difiere"("p_arbol" "jsonb", "p_foto_url" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT p_arbol ? 'foto_base' AND p_foto_url IS DISTINCT FROM p_arbol->>'foto_base';
$$;

ALTER FUNCTION "public"."sync_subgroup_foto_difiere"("jsonb", "text") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."sync_subgroup_foto_difiere"("jsonb", "text") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."sync_subgroup_foto_difiere"("jsonb", "text") TO "service_role";

-- El punto del servidor no es el que el móvil vio. Latitud, longitud y momento de
-- captura lo identifican; la precisión viaja con él. Sin `gps_base`, nunca.
CREATE OR REPLACE FUNCTION "public"."sync_subgroup_gps_difiere"(
  "p_arbol" "jsonb", "p_latitude" double precision, "p_longitude" double precision, "p_captured_at" timestamp with time zone
) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT p_arbol ? 'gps_base'
     AND (p_latitude, p_longitude, p_captured_at) IS DISTINCT FROM (
           (p_arbol->'gps_base'->>'latitude')::DOUBLE PRECISION,
           (p_arbol->'gps_base'->>'longitude')::DOUBLE PRECISION,
           (p_arbol->'gps_base'->>'gps_captured_at')::TIMESTAMPTZ);
$$;

ALTER FUNCTION "public"."sync_subgroup_gps_difiere"("jsonb", double precision, double precision, timestamp with time zone) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."sync_subgroup_gps_difiere"("jsonb", double precision, double precision, timestamp with time zone) FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."sync_subgroup_gps_difiere"("jsonb", double precision, double precision, timestamp with time zone) TO "service_role";

-- Los árboles a subir, con la foto y el punto del servidor donde difieren de la
-- base. Corre después de `conservar_especies`, que ya tomó los árboles FOR UPDATE.
CREATE OR REPLACE FUNCTION "public"."sync_subgroup_conservar_fotos_y_gps"("p_trees" "jsonb") RETURNS "jsonb"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  SELECT coalesce(jsonb_agg(
           t
           || CASE WHEN actual.id IS NOT NULL AND sync_subgroup_foto_difiere(t, actual.foto_url)
                   THEN jsonb_build_object('foto_url', actual.foto_url)
                   ELSE '{}' END
           || CASE WHEN actual.id IS NOT NULL
                    AND sync_subgroup_gps_difiere(t, actual.latitude, actual.longitude, actual.gps_captured_at)
                   THEN jsonb_build_object(
                          'latitude', actual.latitude, 'longitude', actual.longitude,
                          'gps_accuracy', actual.gps_accuracy, 'gps_captured_at', actual.gps_captured_at)
                   ELSE '{}' END
           ORDER BY e.orden), '[]')
    FROM jsonb_array_elements(p_trees) WITH ORDINALITY AS e(t, orden)
    LEFT JOIN trees actual ON actual.id = (t->>'id')::UUID;
$$;

ALTER FUNCTION "public"."sync_subgroup_conservar_fotos_y_gps"("jsonb") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."sync_subgroup_conservar_fotos_y_gps"("jsonb") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."sync_subgroup_conservar_fotos_y_gps"("jsonb") TO "service_role";

-- Anota para el cron los archivos que ningún árbol va a referenciar: la foto que
-- subió el móvil y el servidor no aceptó, y la que reemplazó una foto nueva. Lo
-- que mandó el móvil cuenta solo si es un archivo de ese árbol en esa plantación.
-- Va antes del upsert, con `foto_url` todavía sin pisar.
CREATE OR REPLACE FUNCTION "public"."sync_subgroup_anotar_fotos_descartadas"("p_subgroup" "jsonb", "p_enviados" "jsonb", "p_finales" "jsonb") RETURNS void
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  INSERT INTO fotos_quitadas (storage_path, tree_id, plantation_id, quitada_por)
  SELECT DISTINCT c.path, actual.id, (p_subgroup->>'plantation_id')::UUID, auth.uid()
    FROM jsonb_array_elements(p_enviados) WITH ORDINALITY AS e(t, orden)
    JOIN jsonb_array_elements(p_finales) WITH ORDINALITY AS f(t, orden) ON f.orden = e.orden
    JOIN trees actual ON actual.id = (e.t->>'id')::UUID
   CROSS JOIN LATERAL (VALUES
           (CASE WHEN arbol_de_foto(e.t->>'foto_url') = actual.id
                  AND starts_with(e.t->>'foto_url', 'plantations/' || (p_subgroup->>'plantation_id') || '/')
                 THEN path_foto_storage(e.t->>'foto_url') END),
           (path_foto_storage(actual.foto_url))
         ) AS c(path)
   WHERE c.path IS NOT NULL
     AND c.path IS DISTINCT FROM path_foto_storage(COALESCE(f.t->>'foto_url', actual.foto_url));
$$;

ALTER FUNCTION "public"."sync_subgroup_anotar_fotos_descartadas"("jsonb", "jsonb", "jsonb") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."sync_subgroup_anotar_fotos_descartadas"("jsonb", "jsonb", "jsonb") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."sync_subgroup_anotar_fotos_descartadas"("jsonb", "jsonb", "jsonb") TO "service_role";

-- ── D. Árboles ───────────────────────────────────────────────────────────────

-- Igual a 066 salvo el prefijo nuevo del SubID: parcela y grupo vigentes. Si el
-- servidor conservó su código de grupo, el SubID armado con el del móvil pasa a
-- llevar el del servidor.
CREATE OR REPLACE FUNCTION "public"."sync_subgroup_upsert_arboles"("p_subgroup" "jsonb", "p_trees" "jsonb", "p_parcela_codigo" "text") RETURNS void
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_prefijo_cliente TEXT := (p_subgroup->>'parcela_codigo') || (p_subgroup->>'codigo');
  v_grupo UUID := (p_subgroup->>'id')::UUID;
  v_prefijo_vigente TEXT;
  v_escritos INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_trees) AS t
    WHERE COALESCE((t->>'group_id')::UUID, (t->>'subgroup_id')::UUID) IS DISTINCT FROM v_grupo
  ) THEN
    RAISE EXCEPTION 'sync_subgroup: árbol con otro grupo que %', v_grupo USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT p_parcela_codigo || codigo INTO v_prefijo_vigente FROM groups WHERE id = v_grupo;

  INSERT INTO trees (
    id, group_id, species_id, posicion, sub_id, foto_url,
    plantacion_id, global_id, usuario_registro, created_at,
    latitude, longitude, gps_accuracy, gps_captured_at
  )
  SELECT
    (t->>'id')::UUID,
    v_grupo,
    NULLIF(t->>'species_id', '')::UUID,
    (t->>'posicion')::INTEGER,
    CASE WHEN starts_with(t->>'sub_id', v_prefijo_cliente)
         THEN v_prefijo_vigente || substr(t->>'sub_id', length(v_prefijo_cliente) + 1)
         ELSE t->>'sub_id' END,
    t->>'foto_url',
    (t->>'plantacion_id')::INTEGER,
    (t->>'global_id')::INTEGER,
    (t->>'usuario_registro')::UUID,
    (t->>'created_at')::TIMESTAMPTZ,
    (t->>'latitude')::DOUBLE PRECISION,
    (t->>'longitude')::DOUBLE PRECISION,
    (t->>'gps_accuracy')::DOUBLE PRECISION,
    (t->>'gps_captured_at')::TIMESTAMPTZ
  FROM jsonb_array_elements(p_trees) AS t
  ON CONFLICT (id) DO UPDATE SET
    species_id = EXCLUDED.species_id,
    sub_id = EXCLUDED.sub_id,
    foto_url = COALESCE(EXCLUDED.foto_url, trees.foto_url),
    plantacion_id = COALESCE(EXCLUDED.plantacion_id, trees.plantacion_id),
    global_id = COALESCE(EXCLUDED.global_id, trees.global_id),
    latitude = COALESCE(EXCLUDED.latitude, trees.latitude),
    longitude = COALESCE(EXCLUDED.longitude, trees.longitude),
    gps_accuracy = COALESCE(EXCLUDED.gps_accuracy, trees.gps_accuracy),
    gps_captured_at = COALESCE(EXCLUDED.gps_captured_at, trees.gps_captured_at)
  WHERE trees.group_id = EXCLUDED.group_id;

  GET DIAGNOSTICS v_escritos = ROW_COUNT;
  IF v_escritos < jsonb_array_length(p_trees) THEN
    RAISE EXCEPTION 'sync_subgroup: árbol de otro grupo que %', v_grupo USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

ALTER FUNCTION "public"."sync_subgroup_upsert_arboles"("jsonb", "jsonb", "text") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."sync_subgroup_upsert_arboles"("jsonb", "jsonb", "text") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."sync_subgroup_upsert_arboles"("jsonb", "jsonb", "text") TO "service_role";

-- ── E. Respuesta ─────────────────────────────────────────────────────────────

-- Lo que el servidor conservó y quedó distinto de lo que mandó el móvil:
-- `{grupo: {campo: valor}, arboles: [{id, species_id?, foto_url?, gps?}]}`. Un
-- campo sin base nunca vuelve. Foto y GPS vuelven aunque el móvil no los haya
-- mandado (null): el móvil adopta el del servidor.
CREATE OR REPLACE FUNCTION "public"."sync_subgroup_conservados"("p_subgroup" "jsonb", "p_grupo" "jsonb", "p_trees" "jsonb") RETURNS "jsonb"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  SELECT jsonb_build_object(
    'grupo', (
      SELECT coalesce(jsonb_object_agg(c.campo, p_grupo->c.campo), '{}')
        FROM unnest(ARRAY['nombre', 'codigo', 'tipo', 'estado']) AS c(campo)
       WHERE p_grupo->c.campo IS DISTINCT FROM p_subgroup->c.campo),
    'arboles', (
      SELECT coalesce(jsonb_agg(d.conservado || jsonb_build_object('id', tr.id) ORDER BY tr.id), '[]')
        FROM jsonb_array_elements(p_trees) AS t
        JOIN trees tr ON tr.id = (t->>'id')::UUID
       CROSS JOIN LATERAL (SELECT
           CASE WHEN t ? 'species_base_id' AND tr.species_id IS DISTINCT FROM NULLIF(t->>'species_id', '')::UUID
                THEN jsonb_build_object('species_id', tr.species_id) ELSE '{}' END
        || CASE WHEN sync_subgroup_foto_difiere(t, tr.foto_url) AND tr.foto_url IS DISTINCT FROM t->>'foto_url'
                THEN jsonb_build_object('foto_url', tr.foto_url) ELSE '{}' END
        || CASE WHEN sync_subgroup_gps_difiere(t, tr.latitude, tr.longitude, tr.gps_captured_at)
                 AND (tr.latitude, tr.longitude, tr.gps_captured_at) IS DISTINCT FROM (
                       (t->>'latitude')::DOUBLE PRECISION, (t->>'longitude')::DOUBLE PRECISION,
                       (t->>'gps_captured_at')::TIMESTAMPTZ)
                THEN jsonb_build_object('gps', jsonb_build_object(
                       'latitude', tr.latitude, 'longitude', tr.longitude,
                       'gps_accuracy', tr.gps_accuracy, 'gps_captured_at', tr.gps_captured_at))
                ELSE '{}' END AS conservado) AS d
       WHERE d.conservado <> '{}')
  );
$$;

ALTER FUNCTION "public"."sync_subgroup_conservados"("jsonb", "jsonb", "jsonb") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."sync_subgroup_conservados"("jsonb", "jsonb", "jsonb") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."sync_subgroup_conservados"("jsonb", "jsonb", "jsonb") TO "service_role";

-- ── F. Orquestadora ──────────────────────────────────────────────────────────

-- El grupo se escribe con lo que conservó el servidor; los árboles se arman con
-- el payload original, porque sus SubID llevan el código de grupo del móvil.
-- `conservadas` queda para el APK que no lee `conservados`.
CREATE OR REPLACE FUNCTION "public"."sync_subgroup"("p_subgroup" "jsonb", "p_trees" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_grupo JSONB;
  v_rechazo TEXT;
  v_parcela_codigo TEXT;
  v_arboles JSONB;
BEGIN
  -- Locks en este orden: grupo → parcela → árboles → plantation_species. Otra
  -- escritura que tome más de uno tiene que seguirlo, o se pueden trabar.
  v_grupo := sync_subgroup_conservar_grupo(p_subgroup);
  v_rechazo := sync_subgroup_rechazo(v_grupo);
  IF v_rechazo IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_rechazo);
  END IF;

  PERFORM sync_subgroup_upsert_grupo(v_grupo);
  v_parcela_codigo := sync_subgroup_codigo_parcela(p_subgroup);
  v_arboles := sync_subgroup_conservar_fotos_y_gps(sync_subgroup_conservar_especies(p_subgroup, p_trees));
  PERFORM sync_subgroup_anotar_fotos_descartadas(p_subgroup, p_trees, v_arboles);
  PERFORM sync_subgroup_upsert_arboles(p_subgroup, v_arboles, v_parcela_codigo);
  PERFORM sync_subgroup_habilitar_especies(p_subgroup, v_arboles);

  RETURN jsonb_build_object(
    'success', true,
    'conservadas', sync_subgroup_conservadas(p_trees),
    'conservados', sync_subgroup_conservados(p_subgroup, v_grupo, p_trees));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'UNKNOWN');
END;
$$;
