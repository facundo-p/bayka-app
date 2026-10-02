-- `sync_subgroup` no escribe fuera del grupo que sube (#732).
--
-- Es SECURITY DEFINER y solo validaba la membresía en el `plantation_id` del
-- payload. Con ids ajenos en el payload, un miembro de cualquier plantación
-- pisaba especie, SubID y foto de un árbol de otra plantación (el upsert por id
-- no miraba el grupo), renombraba o finalizaba un grupo ajeno, le sumaba
-- árboles, o creaba un grupo en una parcela ajena. Ningún cliente legítimo
-- manda nada de eso: los árboles nunca cambian de grupo ni los grupos de
-- plantación o parcela, así que se rechaza todo el sync sin escribir nada.
--
-- Redefine dos partes de 064, sin tocar la orquestadora:
-- - `sync_subgroup_rechazo`: un grupo o una parcela de otra plantación responde
--   REFERENCIA_AJENA.
-- - `sync_subgroup_upsert_arboles`: un árbol de otro grupo (existente o por su
--   group_id) lanza 42501, que la orquestadora responde como UNKNOWN y deshace.
--
-- Rollback: volver a correr de 064 `sync_subgroup_rechazo` y
-- `sync_subgroup_upsert_arboles`, con sus OWNER, REVOKE y GRANT. No hay columnas
-- ni datos que deshacer. En el repo, el rollback borra también el test 46.

-- ── Rechazo ──────────────────────────────────────────────────────────────────

-- El primer motivo para no escribir nada, o NULL. REFERENCIA_AJENA va antes de
-- los duplicados para no revelar códigos ni nombres de una parcela ajena.
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
    WHERE id = (p_subgroup->>'id')::UUID
      AND plantation_id <> (p_subgroup->>'plantation_id')::UUID
  ) OR EXISTS (
    SELECT 1 FROM parcelas
    WHERE id = (p_subgroup->>'parcela_id')::UUID
      AND plantation_id <> (p_subgroup->>'plantation_id')::UUID
  ) THEN
    RETURN 'REFERENCIA_AJENA';
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

-- ── Árboles ──────────────────────────────────────────────────────────────────

-- Un SubID armado con el código de parcela que conoce el móvil pasa al vigente.
-- Con parcela + grupo, igual que 053: un `P10L1…` en la parcela `P1` no es suyo.
-- Lo que el móvil no manda (foto, ids, GPS) no pisa lo que ya hay.
--
-- Cada árbol es del grupo que sube: por su group_id y, si ya existe, por el
-- grupo que tiene. El WHERE del DO UPDATE saltea el árbol de otro grupo y el
-- conteo lo convierte en error, también si alguien lo crea entre el chequeo y
-- el INSERT.
CREATE OR REPLACE FUNCTION "public"."sync_subgroup_upsert_arboles"("p_subgroup" "jsonb", "p_trees" "jsonb", "p_parcela_codigo" "text") RETURNS void
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_prefijo_cliente TEXT := (p_subgroup->>'parcela_codigo') || (p_subgroup->>'codigo');
  v_grupo UUID := (p_subgroup->>'id')::UUID;
  v_escritos INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_trees) AS t
    WHERE COALESCE((t->>'group_id')::UUID, (t->>'subgroup_id')::UUID) IS DISTINCT FROM v_grupo
  ) THEN
    RAISE EXCEPTION 'sync_subgroup: árbol con otro grupo que %', v_grupo USING ERRCODE = 'insufficient_privilege';
  END IF;

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
