-- Una plantación finalizada es inmutable (#469). Hasta acá la regla vivía sólo en
-- la UI del móvil: ni las policies ni los RPC sabían qué significa 'finalizada',
-- así que un APK viejo o un camino de UI sin gatear la salteaba entera.
--
-- La excepción es de ROL, no de estado: un superadmin sí puede escribir sobre una
-- finalizada, desde la web (#470). El conjunto de roles habilitados vive en UN
-- solo array, abajo: sumar 'admin' es editar esa línea y nada más.

-- ── A. Quién puede escribir sobre una plantación finalizada ──────────────────

CREATE OR REPLACE FUNCTION "public"."puede_editar_finalizada"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND activo
      -- Para habilitar también a los admin: agregar 'admin' a este array.
      AND rol = ANY (ARRAY['superadmin'])
  );
$$;

ALTER FUNCTION "public"."puede_editar_finalizada"() OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."puede_editar_finalizada"() TO "authenticated", "service_role";

-- Una plantación inexistente NO es escribible: el FALSE de un id que no existe es
-- el mismo que el de una finalizada, y las policies no tienen que distinguirlos.
CREATE OR REPLACE FUNCTION "public"."plantacion_escribible"("p_plantation_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM plantations p
    WHERE p.id = p_plantation_id
      AND (p.estado <> 'finalizada' OR puede_editar_finalizada())
  );
$$;

ALTER FUNCTION "public"."plantacion_escribible"("uuid") OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."plantacion_escribible"("uuid") TO "authenticated", "service_role";

-- ── B. Los dos RPC: SECURITY DEFINER saltea RLS, así que validan por su cuenta ──

-- Cambia respecto de 036: las filas de una plantación no escribible se excluyen y
-- sus ids vuelven en `rechazados`, para que el cliente las deje pendientes hasta
-- una reapertura (#470).
--
-- Son los ids, no un contador: un id que ya no está en el server —otro device lo
-- borró, o nunca se subió— tampoco se borra acá, y ése SÍ hay que limpiarlo. Con
-- un contador los dos casos se ven iguales y el registro no se vacía nunca.
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
  v_rechazados UUID[] := '{}';
BEGIN
  SELECT array_agg((valor->>'id')::UUID) INTO v_arboles
  FROM jsonb_array_elements(p_borrados) AS b(valor) WHERE valor->>'tipo' = 'arbol';

  SELECT array_agg((valor->>'id')::UUID) INTO v_grupos
  FROM jsonb_array_elements(p_borrados) AS b(valor) WHERE valor->>'tipo' = 'grupo';

  -- Rechazados = los que EXISTEN y cuya plantación no es escribible. Se calcula
  -- antes de borrar, mientras las filas todavía están.
  SELECT COALESCE(array_agg(x.id), '{}') INTO v_rechazados FROM (
    SELECT t.id FROM trees t JOIN groups g ON g.id = t.group_id
    WHERE v_arboles IS NOT NULL AND t.id = ANY(v_arboles)
      AND NOT plantacion_escribible(g.plantation_id)
    UNION ALL
    SELECT g.id FROM groups g
    WHERE v_grupos IS NOT NULL AND g.id = ANY(v_grupos)
      AND NOT plantacion_escribible(g.plantation_id)
  ) AS x;

  -- La membresía y el estado se validan contra la plantación REAL de cada fila, no
  -- contra la que venga en el payload: el cliente no decide sobre qué puede borrar.
  IF v_arboles IS NOT NULL THEN
    DELETE FROM trees t
    USING groups g
    WHERE t.id = ANY(v_arboles)
      AND g.id = t.group_id
      AND is_plantation_member(g.plantation_id)
      AND plantacion_escribible(g.plantation_id);
    GET DIAGNOSTICS v_arboles_borrados = ROW_COUNT;
  END IF;

  -- Después de los árboles: un grupo borrado se lleva los suyos por cascada, así
  -- que el orden inverso dejaría ids de árboles sin matchear (igual es no-op).
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
    'rechazados', to_jsonb(v_rechazados)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

ALTER FUNCTION "public"."sincronizar_borrados"("jsonb") OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."sincronizar_borrados"("jsonb") TO "authenticated", "service_role";

-- Cambia respecto del baseline: un código de error propio para la plantación
-- finalizada. Que sea distinto de PERMISSION importa — el técnico SÍ es miembro,
-- y el mensaje que le corresponde es otro.
CREATE OR REPLACE FUNCTION "public"."sync_subgroup"("p_subgroup" "jsonb", "p_trees" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM plantation_users pu
    WHERE pu.plantation_id = (p_subgroup->>'plantation_id')::UUID
      AND pu.user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION');
  END IF;

  IF NOT plantacion_escribible((p_subgroup->>'plantation_id')::UUID) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PLANTACION_FINALIZADA');
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

-- ── C. Policies: la red que no depende de la versión de APK instalada ────────
--
-- Se reescriben con `is_plantation_member` (el helper de 033) en vez de repetir el
-- EXISTS anidado: misma semántica, y el agregado queda a la vista.
--
-- `generate_tree_ids` NO se ve afectado: es SECURITY DEFINER OWNER postgres, así
-- que escribe `trees` sin pasar por RLS. Hay un test pgTAP que lo fija.

DROP POLICY IF EXISTS "Plantation members can insert trees" ON "public"."trees";
CREATE POLICY "Plantation members can insert trees" ON "public"."trees"
  FOR INSERT TO "authenticated"
  WITH CHECK (EXISTS (
    SELECT 1 FROM groups sg
    WHERE sg.id = trees.group_id
      AND is_plantation_member(sg.plantation_id)
      AND plantacion_escribible(sg.plantation_id)
  ));

DROP POLICY IF EXISTS "Plantation members can update trees" ON "public"."trees";
CREATE POLICY "Plantation members can update trees" ON "public"."trees"
  FOR UPDATE TO "authenticated"
  USING (EXISTS (
    SELECT 1 FROM groups sg
    WHERE sg.id = trees.group_id
      AND is_plantation_member(sg.plantation_id)
      AND plantacion_escribible(sg.plantation_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM groups sg
    WHERE sg.id = trees.group_id
      AND is_plantation_member(sg.plantation_id)
      AND plantacion_escribible(sg.plantation_id)
  ));

DROP POLICY IF EXISTS "Users can insert own subgroups" ON "public"."groups";
CREATE POLICY "Users can insert own subgroups" ON "public"."groups"
  FOR INSERT TO "authenticated"
  WITH CHECK (
    auth.uid() = usuario_creador
    AND is_plantation_member(groups.plantation_id)
    AND plantacion_escribible(groups.plantation_id)
  );

DROP POLICY IF EXISTS "Plantation members can insert parcelas" ON "public"."parcelas";
CREATE POLICY "Plantation members can insert parcelas" ON "public"."parcelas"
  FOR INSERT TO "authenticated"
  WITH CHECK (
    is_plantation_member(parcelas.plantation_id)
    AND plantacion_escribible(parcelas.plantation_id)
  );

-- El borrado de parcela es un tombstone, o sea un UPDATE de `deleted_at`: sin esta
-- policy el "Eliminar parcela" del móvil seguía llegando al server.
DROP POLICY IF EXISTS "Plantation members can update parcelas" ON "public"."parcelas";
CREATE POLICY "Plantation members can update parcelas" ON "public"."parcelas"
  FOR UPDATE TO "authenticated"
  USING (
    is_plantation_member(parcelas.plantation_id)
    AND plantacion_escribible(parcelas.plantation_id)
  )
  WITH CHECK (
    is_plantation_member(parcelas.plantation_id)
    AND plantacion_escribible(parcelas.plantation_id)
  );

DROP POLICY IF EXISTS "Plantation members can delete parcelas" ON "public"."parcelas";
CREATE POLICY "Plantation members can delete parcelas" ON "public"."parcelas"
  FOR DELETE TO "authenticated"
  USING (
    is_plantation_member(parcelas.plantation_id)
    AND plantacion_escribible(parcelas.plantation_id)
  );

DROP POLICY IF EXISTS "Admin can insert plantation_species" ON "public"."plantation_species";
CREATE POLICY "Admin can insert plantation_species" ON "public"."plantation_species"
  FOR INSERT TO "authenticated"
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.rol = ANY (ARRAY['admin', 'superadmin']))
    AND plantacion_escribible(plantation_species.plantation_id)
  );

DROP POLICY IF EXISTS "Admin can update plantation_species" ON "public"."plantation_species";
CREATE POLICY "Admin can update plantation_species" ON "public"."plantation_species"
  FOR UPDATE TO "authenticated"
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.rol = ANY (ARRAY['admin', 'superadmin']))
    AND plantacion_escribible(plantation_species.plantation_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.rol = ANY (ARRAY['admin', 'superadmin']))
    AND plantacion_escribible(plantation_species.plantation_id)
  );

DROP POLICY IF EXISTS "Admin can delete plantation_species" ON "public"."plantation_species";
CREATE POLICY "Admin can delete plantation_species" ON "public"."plantation_species"
  FOR DELETE TO "authenticated"
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.rol = ANY (ARRAY['admin', 'superadmin']))
    AND plantacion_escribible(plantation_species.plantation_id)
  );

-- El estado va SOLO en el USING, que se evalúa sobre la fila VIEJA. En el WITH
-- CHECK bloquearía la propia finalización: la fila nueva ya es 'finalizada'.
-- Con esto, finalizar sigue siendo de admin, y editar o reabrir una finalizada
-- queda para quien `puede_editar_finalizada` (#470).
DROP POLICY IF EXISTS "Admin can update plantations" ON "public"."plantations";
CREATE POLICY "Admin can update plantations" ON "public"."plantations"
  FOR UPDATE TO "authenticated"
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.rol = ANY (ARRAY['admin', 'superadmin']))
    AND plantacion_escribible(plantations.id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.rol = ANY (ARRAY['admin', 'superadmin']))
  );
