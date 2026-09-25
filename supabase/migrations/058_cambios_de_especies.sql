-- Especies de la plantación por altas y bajas (#635).
--
-- `reemplazar_especies_plantacion` recibe la lista entera: un teléfono que la
-- guardó offline pisaría lo que la web cambió en el medio. Con altas y bajas
-- cada lado toca solo lo suyo, y reintentar no cambia el resultado.
--
-- A. Orden: alfabético por nombre (decisión de Facu). Los clientes nuevos
--    ordenan al leer; `orden_visual` se sigue llenando para los APKs instalados,
--    que ordenan por esa columna. Colación española explícita, la misma que usan
--    web y mobile: sin ella "álamo" o una minúscula quedan al final.
-- B. `aplicar_cambios_especies`: una baja con árboles se rechaza sola y el resto
--    se aplica.
-- C. `sync_subgroup` re-habilita la especie de los árboles que suben si alguien
--    la quitó mientras tanto: si no, quedan árboles de una especie sin botón.

-- ── A. Orden alfabético ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION "public"."ordenar_especies_plantacion"("p_plantacion" "uuid") RETURNS void
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  UPDATE plantation_species ps SET orden_visual = o.orden
  FROM (
    SELECT ps2.species_id, (row_number() OVER (ORDER BY s.nombre COLLATE "es-x-icu", s.id) - 1)::INTEGER AS orden
    FROM plantation_species ps2 JOIN species s ON s.id = ps2.species_id
    WHERE ps2.plantation_id = p_plantacion
  ) o
  WHERE ps.plantation_id = p_plantacion
    AND ps.species_id = o.species_id
    AND ps.orden_visual IS DISTINCT FROM o.orden;
$$;

ALTER FUNCTION "public"."ordenar_especies_plantacion"("uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."ordenar_especies_plantacion"("uuid") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."ordenar_especies_plantacion"("uuid") TO "service_role";

-- ── B. Altas y bajas ─────────────────────────────────────────────────────────

-- Respuesta: `{success: false, error}` si la plantación no admite el cambio (nada
-- se aplica), o `{success: true, rechazadas: [{species_id, error}]}` con las que
-- no se aplicaron. Una especie en las dos listas cuenta como alta.
CREATE OR REPLACE FUNCTION "public"."aplicar_cambios_especies"("p_plantacion" "uuid", "p_altas" "uuid"[], "p_bajas" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_altas UUID[] := coalesce(p_altas, '{}');
  v_bajas UUID[] := coalesce(p_bajas, '{}');
  v_rechazo TEXT;
  v_rechazadas JSONB := '[]';
  v_especie UUID;
BEGIN
  PERFORM 1 FROM plantations WHERE id = p_plantacion FOR SHARE;

  v_rechazo := rechazo_configuracion_plantacion(p_plantacion, plantacion_escribible(p_plantacion));
  IF v_rechazo IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_rechazo);
  END IF;

  SELECT v_rechazadas || coalesce(jsonb_agg(jsonb_build_object('species_id', a.id, 'error', 'ESPECIE_INEXISTENTE')), '[]')
    INTO v_rechazadas
    FROM unnest(v_altas) AS a(id)
   WHERE NOT EXISTS (SELECT 1 FROM species s WHERE s.id = a.id);

  INSERT INTO plantation_species (plantation_id, species_id, orden_visual)
  SELECT DISTINCT p_plantacion, a.id, 0
    FROM unnest(v_altas) AS a(id)
   WHERE EXISTS (SELECT 1 FROM species s WHERE s.id = a.id)
  ON CONFLICT (plantation_id, species_id) DO NOTHING;

  FOR v_especie IN SELECT DISTINCT b.id FROM unnest(v_bajas) AS b(id) WHERE NOT (b.id = ANY (v_altas)) LOOP
    -- El trigger de 055 frena el DELETE si la especie tiene árboles, también uno
    -- que entró recién: el bloque deshace solo esta baja.
    BEGIN
      DELETE FROM plantation_species WHERE plantation_id = p_plantacion AND species_id = v_especie;
    EXCEPTION WHEN restrict_violation THEN
      v_rechazadas := v_rechazadas || jsonb_build_object('species_id', v_especie, 'error', 'ESPECIE_CON_ARBOLES');
    END;
  END LOOP;

  PERFORM ordenar_especies_plantacion(p_plantacion);

  RETURN jsonb_build_object('success', true, 'rechazadas', v_rechazadas);
END;
$$;

ALTER FUNCTION "public"."aplicar_cambios_especies"("uuid", "uuid"[], "uuid"[]) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."aplicar_cambios_especies"("uuid", "uuid"[], "uuid"[]) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."aplicar_cambios_especies"("uuid", "uuid"[], "uuid"[]) TO "authenticated", "service_role";

-- ── C. sync_subgroup re-habilita la especie de sus árboles ───────────────────

-- Igual a 054 salvo el bloque marcado.
CREATE OR REPLACE FUNCTION "public"."sync_subgroup"("p_subgroup" "jsonb", "p_trees" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_motivo TEXT;
  v_prefijo_cliente TEXT;
  v_parcela_codigo TEXT;
  v_rehabilitadas INTEGER;
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

  -- #635: la especie de un árbol que sube vuelve a estar habilitada. El DO UPDATE
  -- sin cambios lockea la fila: una baja concurrente espera a este commit y su
  -- trigger (055) ve estos árboles. DO NOTHING no lockea.
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

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'UNKNOWN');
END;
$$;

ALTER FUNCTION "public"."sync_subgroup"("jsonb", "jsonb") OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."sync_subgroup"("jsonb", "jsonb") TO "authenticated", "service_role";
