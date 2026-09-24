-- `sync_subgroup` solo pisaba `estado` de un grupo existente (#626): renombrar un
-- grupo en el móvil subía los SubID nuevos, pero el grupo seguía con el código
-- viejo en el server. Ahora pisa también `codigo`, `nombre` y `tipo`, los tres
-- campos que el móvil deja editar. El nombre también es único por parcela: un
-- choque devuelve DUPLICATE_NAME en vez de caer en UNKNOWN.
--
-- Además normaliza el prefijo de parcela de los `sub_id` que recibe. El móvil
-- manda en `parcela_codigo` el código con el que los armó; si difiere del de la
-- parcela en el server (un pull que falló antes del push, o un cambio de código
-- en otro dispositivo entre el pull y el push), se reescribe con el vigente. Así
-- el trigger de 053 y este RPC dejan los SubID con el mismo prefijo. Un cliente
-- que no manda `parcela_codigo` sube los SubID como vienen.

CREATE OR REPLACE FUNCTION "public"."sync_subgroup"("p_subgroup" "jsonb", "p_trees" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_motivo TEXT;
  v_prefijo_cliente TEXT;
  v_parcela_codigo TEXT;
BEGIN
  IF NOT is_plantation_member((p_subgroup->>'plantation_id')::UUID) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION');
  END IF;

  v_motivo := motivo_no_escribible((p_subgroup->>'plantation_id')::UUID);
  IF v_motivo IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_motivo);
  END IF;

  IF EXISTS (
    SELECT 1 FROM groups
    WHERE parcela_id = (p_subgroup->>'parcela_id')::UUID
      AND codigo = p_subgroup->>'codigo'
      AND id <> (p_subgroup->>'id')::UUID
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_CODE');
  END IF;

  IF EXISTS (
    SELECT 1 FROM groups
    WHERE parcela_id = (p_subgroup->>'parcela_id')::UUID
      AND nombre = p_subgroup->>'nombre'
      AND id <> (p_subgroup->>'id')::UUID
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_NAME');
  END IF;

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

  -- Con parcela + grupo, igual que 053: un `P10L1…` en la parcela `P1` no es suyo.
  v_prefijo_cliente := (p_subgroup->>'parcela_codigo') || (p_subgroup->>'codigo');
  -- FOR SHARE: un cambio de código concurrente espera a este commit. Si no, su
  -- trigger (053) no ve estos árboles y quedan con el prefijo viejo.
  SELECT codigo INTO v_parcela_codigo FROM parcelas
   WHERE id = (p_subgroup->>'parcela_id')::UUID
     FOR SHARE;

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
         THEN v_parcela_codigo || substr(t->>'sub_id', length(p_subgroup->>'parcela_codigo') + 1)
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

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'UNKNOWN');
END;
$$;

ALTER FUNCTION "public"."sync_subgroup"("jsonb", "jsonb") OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."sync_subgroup"("jsonb", "jsonb") TO "authenticated", "service_role";
