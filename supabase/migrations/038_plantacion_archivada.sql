-- Plantación archivada (#477): oculta de los listados y de solo lectura, reversible.
--
-- Son columnas y no un tercer valor de `estado`: archivar es independiente de
-- activa/finalizada, y desarchivar tiene que devolverla al estado que tenía.
--
-- Solo lectura TAMBIÉN para superadmin: para editarla hay que desarchivarla
-- primero. Como todo pasa por `plantacion_escribible`, las policies y los RPC de
-- 037 heredan la regla sin tocarlos uno por uno.

-- ── A. Columnas ──────────────────────────────────────────────────────────────

ALTER TABLE "public"."plantations"
  ADD COLUMN IF NOT EXISTS "archivada_en" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "archivada_por" "uuid"
    REFERENCES "auth"."users"("id") ON DELETE SET NULL;

-- ── B. Escritura ─────────────────────────────────────────────────────────────

-- NULL = escribible. Un solo lugar decide el código de rechazo, así `sync_subgroup`
-- y `sincronizar_borrados` no pueden informar motivos distintos para la misma fila.
-- Archivada gana sobre finalizada: es lo que hay que resolver primero.
CREATE OR REPLACE FUNCTION "public"."motivo_no_escribible"("p_plantation_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN p.id IS NULL THEN 'PLANTACION_INEXISTENTE'
    WHEN p.archivada_en IS NOT NULL THEN 'PLANTACION_ARCHIVADA'
    WHEN p.estado = 'finalizada' AND NOT puede_editar_finalizada() THEN 'PLANTACION_FINALIZADA'
  END
  FROM (SELECT 1) AS uno
  LEFT JOIN plantations p ON p.id = p_plantation_id;
$$;

ALTER FUNCTION "public"."motivo_no_escribible"("uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."motivo_no_escribible"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."motivo_no_escribible"("uuid") TO "authenticated", "service_role";

CREATE OR REPLACE FUNCTION "public"."plantacion_escribible"("p_plantation_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT motivo_no_escribible(p_plantation_id) IS NULL;
$$;

ALTER FUNCTION "public"."plantacion_escribible"("uuid") OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."plantacion_escribible"("uuid") TO "authenticated", "service_role";

-- ── C. Los RPC de sync ───────────────────────────────────────────────────────

-- Cambia respecto de 037: además de `rechazados` (que siguen leyendo los APK
-- viejos) devuelve `rechazos`, con el motivo de cada id, para que el cliente
-- distinga archivada de finalizada.
CREATE OR REPLACE FUNCTION "public"."sincronizar_borrados"("p_borrados" "jsonb")
RETURNS "jsonb"
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_arboles UUID[];
  v_grupos UUID[];
  v_arboles_borrados INT := 0;
  v_grupos_borrados INT := 0;
  v_rechazos JSONB := '[]';
BEGIN
  SELECT array_agg((valor->>'id')::UUID) INTO v_arboles
  FROM jsonb_array_elements(p_borrados) AS b(valor) WHERE valor->>'tipo' = 'arbol';

  SELECT array_agg((valor->>'id')::UUID) INTO v_grupos
  FROM jsonb_array_elements(p_borrados) AS b(valor) WHERE valor->>'tipo' = 'grupo';

  -- Se calcula antes de borrar, mientras las filas todavía están.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', x.id, 'error', x.motivo)), '[]') INTO v_rechazos
  FROM (
    SELECT t.id, motivo_no_escribible(g.plantation_id) AS motivo
    FROM trees t JOIN groups g ON g.id = t.group_id
    WHERE v_arboles IS NOT NULL AND t.id = ANY(v_arboles)
    UNION ALL
    SELECT g.id, motivo_no_escribible(g.plantation_id)
    FROM groups g
    WHERE v_grupos IS NOT NULL AND g.id = ANY(v_grupos)
  ) AS x
  WHERE x.motivo IS NOT NULL;

  IF v_arboles IS NOT NULL THEN
    DELETE FROM trees t
    USING groups g
    WHERE t.id = ANY(v_arboles)
      AND g.id = t.group_id
      AND is_plantation_member(g.plantation_id)
      AND plantacion_escribible(g.plantation_id);
    GET DIAGNOSTICS v_arboles_borrados = ROW_COUNT;
  END IF;

  IF v_grupos IS NOT NULL THEN
    DELETE FROM groups g
    WHERE g.id = ANY(v_grupos)
      AND is_plantation_member(g.plantation_id)
      AND plantacion_escribible(g.plantation_id);
    GET DIAGNOSTICS v_grupos_borrados = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'arboles', v_arboles_borrados,
    'grupos', v_grupos_borrados,
    'rechazados', COALESCE((SELECT jsonb_agg(r->'id') FROM jsonb_array_elements(v_rechazos) AS r), '[]'),
    'rechazos', v_rechazos
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

ALTER FUNCTION "public"."sincronizar_borrados"("jsonb") OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."sincronizar_borrados"("jsonb") TO "authenticated", "service_role";

-- Cambia respecto de 037: el código de rechazo sale de `motivo_no_escribible`.
CREATE OR REPLACE FUNCTION "public"."sync_subgroup"("p_subgroup" "jsonb", "p_trees" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_motivo TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM plantation_users pu
    WHERE pu.plantation_id = (p_subgroup->>'plantation_id')::UUID
      AND pu.user_id = auth.uid()
  ) THEN
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
    estado = EXCLUDED.estado;

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
    t->>'sub_id',
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

-- ── D. Archivar / desarchivar ────────────────────────────────────────────────

-- Hacen falta como RPC: la policy UPDATE exige que la fila vieja sea escribible,
-- y una archivada no lo es, así que desarchivar por UPDATE es imposible.
-- Sin plantación visible devuelven lo mismo que sin permiso: no se filtra la
-- existencia de plantaciones de otra organización.
CREATE OR REPLACE FUNCTION "public"."puede_archivar_plantacion"("p_plantation_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles pr
    JOIN plantations p ON p.organizacion_id = pr.organizacion_id
    WHERE pr.id = auth.uid()
      AND pr.activo
      AND pr.rol = ANY (ARRAY['admin', 'superadmin'])
      AND p.id = p_plantation_id
  );
$$;

ALTER FUNCTION "public"."puede_archivar_plantacion"("uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."puede_archivar_plantacion"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."puede_archivar_plantacion"("uuid") TO "authenticated", "service_role";

-- Idempotente: archivar una ya archivada conserva la fecha y el autor originales.
CREATE OR REPLACE FUNCTION "public"."archivar_plantacion"("p_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT puede_archivar_plantacion(p_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;

  UPDATE plantations
  SET archivada_en = now(), archivada_por = auth.uid()
  WHERE id = p_id AND archivada_en IS NULL;

  RETURN jsonb_build_object('success', true);
END;
$$;

ALTER FUNCTION "public"."archivar_plantacion"("uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."archivar_plantacion"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."archivar_plantacion"("uuid") TO "authenticated", "service_role";

-- No toca `estado`: una finalizada sigue finalizada, y reabrirla es otra decisión.
CREATE OR REPLACE FUNCTION "public"."desarchivar_plantacion"("p_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT puede_archivar_plantacion(p_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;

  UPDATE plantations
  SET archivada_en = NULL, archivada_por = NULL
  WHERE id = p_id AND archivada_en IS NOT NULL;

  RETURN jsonb_build_object('success', true);
END;
$$;

ALTER FUNCTION "public"."desarchivar_plantacion"("uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."desarchivar_plantacion"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."desarchivar_plantacion"("uuid") TO "authenticated", "service_role";

-- ── E. Archivar solo por RPC ─────────────────────────────────────────────────

-- Sin esto un admin podría archivar con un UPDATE común (la fila vieja SÍ es
-- escribible), salteando el chequeo de organización y de perfil activo del RPC.
DROP POLICY IF EXISTS "Admin can update plantations" ON "public"."plantations";
CREATE POLICY "Admin can update plantations" ON "public"."plantations"
  FOR UPDATE TO "authenticated"
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.rol = ANY (ARRAY['admin', 'superadmin']))
    AND plantacion_escribible(plantations.id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.rol = ANY (ARRAY['admin', 'superadmin']))
    AND plantations.archivada_en IS NULL
    AND plantations.archivada_por IS NULL
  );
