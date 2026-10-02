-- `sync_subgroup` partida en funciones chicas (#734).
--
-- Cada migración que la tocaba la copiaba entera, porque `CREATE OR REPLACE` no
-- cambia un bloque suelto. Ahora es una orquestadora y cada paso vive en su
-- función: un cambio redefine solo la que toca.
--
-- Refactor sin cambio de comportamiento: misma firma, mismos errores, misma
-- respuesta, mismos grants, mismo orden de los pasos y de los locks. Las partes
-- son SECURITY INVOKER: corren como el dueño de `sync_subgroup` (SECURITY
-- DEFINER), y fuera de ella solo las ejecuta service_role.
--
-- Rollback: volver a correr la sección C de 058 (la `sync_subgroup` anterior,
-- con su OWNER y GRANT) y después dropear las partes:
--   DROP FUNCTION IF EXISTS "public"."sync_subgroup_rechazo"("jsonb");
--   DROP FUNCTION IF EXISTS "public"."sync_subgroup_upsert_grupo"("jsonb");
--   DROP FUNCTION IF EXISTS "public"."sync_subgroup_codigo_parcela"("jsonb");
--   DROP FUNCTION IF EXISTS "public"."sync_subgroup_upsert_arboles"("jsonb", "jsonb", "text");
--   DROP FUNCTION IF EXISTS "public"."sync_subgroup_habilitar_especies"("jsonb", "jsonb");
-- No hay columnas ni datos que deshacer. En el repo, el rollback borra también
-- el test 45, que verifica estas partes.

-- ── Rechazo ──────────────────────────────────────────────────────────────────

-- El primer motivo para no escribir nada, o NULL.
CREATE OR REPLACE FUNCTION "public"."sync_subgroup_rechazo"("p_subgroup" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_motivo TEXT;
BEGIN
  IF NOT is_plantation_member((p_subgroup->>'plantation_id')::UUID) THEN
    RETURN 'PERMISSION';
  END IF;

  v_motivo := motivo_no_escribible((p_subgroup->>'plantation_id')::UUID);
  IF v_motivo IS NOT NULL THEN
    RETURN v_motivo;
  END IF;

  IF EXISTS (
    SELECT 1 FROM groups
    WHERE parcela_id = (p_subgroup->>'parcela_id')::UUID
      AND codigo = p_subgroup->>'codigo'
      AND id <> (p_subgroup->>'id')::UUID
  ) THEN
    RETURN 'DUPLICATE_CODE';
  END IF;

  IF EXISTS (
    SELECT 1 FROM groups
    WHERE parcela_id = (p_subgroup->>'parcela_id')::UUID
      AND nombre = p_subgroup->>'nombre'
      AND id <> (p_subgroup->>'id')::UUID
  ) THEN
    RETURN 'DUPLICATE_NAME';
  END IF;

  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."sync_subgroup_rechazo"("jsonb") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."sync_subgroup_rechazo"("jsonb") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."sync_subgroup_rechazo"("jsonb") TO "service_role";

-- ── Grupo ────────────────────────────────────────────────────────────────────

-- Un estado fuera del CHECK (el 'sincronizada' de APKs viejos) llega como finalizada.
CREATE OR REPLACE FUNCTION "public"."sync_subgroup_upsert_grupo"("p_subgroup" "jsonb") RETURNS void
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO groups (id, plantation_id, parcela_id, nombre, codigo, tipo, estado, usuario_creador, created_at)
  VALUES (
    (p_subgroup->>'id')::UUID,
    (p_subgroup->>'plantation_id')::UUID,
    (p_subgroup->>'parcela_id')::UUID,
    p_subgroup->>'nombre',
    p_subgroup->>'codigo',
    p_subgroup->>'tipo',
    CASE WHEN p_subgroup->>'estado' IN ('activa', 'finalizada')
         THEN p_subgroup->>'estado'
         ELSE 'finalizada' END,
    (p_subgroup->>'usuario_creador')::UUID,
    (p_subgroup->>'created_at')::TIMESTAMPTZ
  )
  ON CONFLICT (id) DO UPDATE SET
    estado = EXCLUDED.estado,
    codigo = EXCLUDED.codigo,
    nombre = EXCLUDED.nombre,
    tipo = EXCLUDED.tipo;
END;
$$;

ALTER FUNCTION "public"."sync_subgroup_upsert_grupo"("jsonb") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."sync_subgroup_upsert_grupo"("jsonb") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."sync_subgroup_upsert_grupo"("jsonb") TO "service_role";

-- ── Parcela ──────────────────────────────────────────────────────────────────

-- Código vigente de la parcela. FOR SHARE: un cambio de código concurrente espera
-- a este commit; si no, su trigger (053) no ve estos árboles y quedan con el
-- prefijo viejo.
CREATE OR REPLACE FUNCTION "public"."sync_subgroup_codigo_parcela"("p_subgroup" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_codigo TEXT;
BEGIN
  SELECT codigo INTO v_codigo FROM parcelas
   WHERE id = (p_subgroup->>'parcela_id')::UUID
     FOR SHARE;
  RETURN v_codigo;
END;
$$;

ALTER FUNCTION "public"."sync_subgroup_codigo_parcela"("jsonb") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."sync_subgroup_codigo_parcela"("jsonb") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."sync_subgroup_codigo_parcela"("jsonb") TO "service_role";

-- ── Árboles ──────────────────────────────────────────────────────────────────

-- Un SubID armado con el código de parcela que conoce el móvil pasa al vigente.
-- Con parcela + grupo, igual que 053: un `P10L1…` en la parcela `P1` no es suyo.
-- Lo que el móvil no manda (foto, ids, GPS) no pisa lo que ya hay.
CREATE OR REPLACE FUNCTION "public"."sync_subgroup_upsert_arboles"("p_subgroup" "jsonb", "p_trees" "jsonb", "p_parcela_codigo" "text") RETURNS void
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_prefijo_cliente TEXT := (p_subgroup->>'parcela_codigo') || (p_subgroup->>'codigo');
BEGIN
  INSERT INTO trees (
    id, group_id, species_id, posicion, sub_id, foto_url,
    plantacion_id, global_id, usuario_registro, created_at,
    latitude, longitude, gps_accuracy, gps_captured_at
  )
  SELECT
    (t->>'id')::UUID,
    COALESCE((t->>'group_id')::UUID, (t->>'subgroup_id')::UUID),
    NULLIF(t->>'species_id', '')::UUID,
    (t->>'posicion')::INTEGER,
    CASE WHEN starts_with(t->>'sub_id', v_prefijo_cliente)
         THEN p_parcela_codigo || substr(t->>'sub_id', length(p_subgroup->>'parcela_codigo') + 1)
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
    gps_captured_at = COALESCE(EXCLUDED.gps_captured_at, trees.gps_captured_at);
END;
$$;

ALTER FUNCTION "public"."sync_subgroup_upsert_arboles"("jsonb", "jsonb", "text") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."sync_subgroup_upsert_arboles"("jsonb", "jsonb", "text") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."sync_subgroup_upsert_arboles"("jsonb", "jsonb", "text") TO "service_role";

-- ── Especies ─────────────────────────────────────────────────────────────────

-- La especie de un árbol que sube vuelve a estar habilitada (#635). El DO UPDATE
-- sin cambios lockea la fila: una baja concurrente espera a este commit y su
-- trigger (055) ve estos árboles. DO NOTHING no lockea.
CREATE OR REPLACE FUNCTION "public"."sync_subgroup_habilitar_especies"("p_subgroup" "jsonb", "p_trees" "jsonb") RETURNS void
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_rehabilitadas INTEGER;
BEGIN
  WITH habilitadas AS (
    INSERT INTO plantation_species (plantation_id, species_id, orden_visual)
    SELECT DISTINCT (p_subgroup->>'plantation_id')::UUID, NULLIF(t->>'species_id', '')::UUID, 0
      FROM jsonb_array_elements(p_trees) AS t
     WHERE NULLIF(t->>'species_id', '') IS NOT NULL
    ON CONFLICT (plantation_id, species_id) DO UPDATE SET orden_visual = plantation_species.orden_visual
    RETURNING (xmax = 0) AS nueva
  )
  SELECT count(*) FILTER (WHERE nueva) INTO v_rehabilitadas FROM habilitadas;
  IF v_rehabilitadas > 0 THEN
    PERFORM ordenar_especies_plantacion((p_subgroup->>'plantation_id')::UUID);
  END IF;
END;
$$;

ALTER FUNCTION "public"."sync_subgroup_habilitar_especies"("jsonb", "jsonb") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."sync_subgroup_habilitar_especies"("jsonb", "jsonb") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."sync_subgroup_habilitar_especies"("jsonb", "jsonb") TO "service_role";

-- ── Orquestadora ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION "public"."sync_subgroup"("p_subgroup" "jsonb", "p_trees" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_rechazo TEXT;
  v_parcela_codigo TEXT;
BEGIN
  v_rechazo := sync_subgroup_rechazo(p_subgroup);
  IF v_rechazo IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_rechazo);
  END IF;

  -- Locks en este orden: grupo → parcela → árboles → plantation_species. Otra
  -- escritura que tome más de uno tiene que seguirlo, o se pueden trabar.
  PERFORM sync_subgroup_upsert_grupo(p_subgroup);
  v_parcela_codigo := sync_subgroup_codigo_parcela(p_subgroup);
  PERFORM sync_subgroup_upsert_arboles(p_subgroup, p_trees, v_parcela_codigo);
  PERFORM sync_subgroup_habilitar_especies(p_subgroup, p_trees);

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'UNKNOWN');
END;
$$;

ALTER FUNCTION "public"."sync_subgroup"("jsonb", "jsonb") OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."sync_subgroup"("jsonb", "jsonb") TO "authenticated", "service_role";
