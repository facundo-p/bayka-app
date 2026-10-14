-- La sincronización deja de escribir los IDs numéricos de los árboles (#822).
--
-- El ID Global sale de la app y el ID Parcial se calcula al exportar, en web y en
-- mobile. Ningún cliente escribe ni lee ya `trees.global_id` ni
-- `trees.plantacion_id`. `sync_subgroup_upsert_arboles` deja de tomarlos del
-- payload: si un APK los manda, se ignoran sin fallar. Un árbol que ya tenía IDs
-- los conserva.
--
-- No se dropea nada todavía: el APK de prod 1.3.0 lee `global_id` del pull para
-- habilitar CSV/Excel. Quedan para la migración que los borre, cuando ese APK ya
-- no esté en uso:
-- - las columnas `trees.global_id` y `trees.plantacion_id`;
-- - `generate_tree_ids`, `next_global_id_seed` y `plantation_ids_status`, que la
--   web dejó de llamar.
--
-- Rollback: volver a correr `sync_subgroup_upsert_arboles` de 075. En el repo, el
-- rollback borra también el test 63 y devuelve el test 44 a 075.

-- Igual a 075 sin `plantacion_id` ni `global_id`.
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
    usuario_registro, created_at,
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

COMMENT ON COLUMN "public"."trees"."global_id" IS 'Sin uso desde #822; se dropea cuando ningún APK de prod lo lea del pull.';
COMMENT ON COLUMN "public"."trees"."plantacion_id" IS 'Sin uso desde #822: el ID Parcial se calcula al exportar.';
COMMENT ON FUNCTION "public"."generate_tree_ids"("uuid", integer) IS 'Sin uso desde #822; se dropea con trees.global_id.';
COMMENT ON FUNCTION "public"."next_global_id_seed"() IS 'Sin uso desde #822; se dropea con trees.global_id.';
COMMENT ON FUNCTION "public"."plantation_ids_status"("uuid") IS 'Sin uso desde #822; se dropea con trees.global_id.';
