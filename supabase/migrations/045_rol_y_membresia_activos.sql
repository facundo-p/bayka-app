-- Un perfil inactivo no pasa ningún gate por rol ni por membresía (#508). El ban
-- en Auth corta el refresh, pero un access token emitido antes sigue vigente
-- hasta expirar, y una desactivación por SQL directo no banea.
--
-- Las policies de admin que quedaban con el EXISTS inline pasan a `is_admin()`,
-- que exige activo desde 043 (#506). Así la condición vive en un solo lugar.
--
-- Nada legítimo depende de un perfil inactivo: la edge function usa service_role,
-- que no evalúa RLS, y los triggers de membresía ya filtran por activo.

-- ── A. Helpers ───────────────────────────────────────────────────────────────

-- Las membresías no se borran al desactivar (la reactivación las recupera tal
-- cual): el perfil activo se exige acá. En el móvil, el pull de un inactivo ve
-- la plantación como sin acceso y conserva la copia local.
CREATE OR REPLACE FUNCTION "public"."is_plantation_member"("p_plantation_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM plantation_users pu
    JOIN profiles pr ON pr.id = pu.user_id
    WHERE pu.plantation_id = p_plantation_id
      AND pu.user_id = auth.uid()
      AND pr.activo
  );
$$;

ALTER FUNCTION "public"."is_plantation_member"("uuid") OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."is_plantation_member"("uuid") TO "authenticated", "service_role";

CREATE OR REPLACE FUNCTION "public"."is_superadmin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND activo
      AND rol = 'superadmin'
  );
$$;

ALTER FUNCTION "public"."is_superadmin"() OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."is_superadmin"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."is_superadmin"() TO "authenticated", "service_role";

-- Misma regla que 038, con el predicado de admin en `is_admin()`.
CREATE OR REPLACE FUNCTION "public"."puede_archivar_plantacion"("p_plantation_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT is_admin() AND EXISTS (
    SELECT 1 FROM plantations p
    WHERE p.id = p_plantation_id
      AND p.organizacion_id = current_organizacion_id()
  );
$$;

ALTER FUNCTION "public"."puede_archivar_plantacion"("uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."puede_archivar_plantacion"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."puede_archivar_plantacion"("uuid") TO "authenticated", "service_role";

-- ── B. Policies de admin ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admin can insert plantations" ON "public"."plantations";
CREATE POLICY "Admin can insert plantations" ON "public"."plantations"
  FOR INSERT TO "authenticated"
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin can update plantations" ON "public"."plantations";
CREATE POLICY "Admin can update plantations" ON "public"."plantations"
  FOR UPDATE TO "authenticated"
  USING (
    is_admin()
    AND plantacion_escribible(plantations.id)
  )
  WITH CHECK (
    is_admin()
    AND plantations.archivada_en IS NULL
    AND plantations.archivada_por IS NULL
  );

DROP POLICY IF EXISTS "Admin can insert plantation_species" ON "public"."plantation_species";
CREATE POLICY "Admin can insert plantation_species" ON "public"."plantation_species"
  FOR INSERT TO "authenticated"
  WITH CHECK (
    is_admin()
    AND plantacion_escribible(plantation_species.plantation_id)
  );

DROP POLICY IF EXISTS "Admin can update plantation_species" ON "public"."plantation_species";
CREATE POLICY "Admin can update plantation_species" ON "public"."plantation_species"
  FOR UPDATE TO "authenticated"
  USING (
    is_admin()
    AND plantacion_escribible(plantation_species.plantation_id)
  )
  WITH CHECK (
    is_admin()
    AND plantacion_escribible(plantation_species.plantation_id)
  );

DROP POLICY IF EXISTS "Admin can delete plantation_species" ON "public"."plantation_species";
CREATE POLICY "Admin can delete plantation_species" ON "public"."plantation_species"
  FOR DELETE TO "authenticated"
  USING (
    is_admin()
    AND plantacion_escribible(plantation_species.plantation_id)
  );

DROP POLICY IF EXISTS "Admin can insert plantation_users" ON "public"."plantation_users";
CREATE POLICY "Admin can insert plantation_users" ON "public"."plantation_users"
  FOR INSERT TO "authenticated"
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin can delete plantation_users" ON "public"."plantation_users";
CREATE POLICY "Admin can delete plantation_users" ON "public"."plantation_users"
  FOR DELETE TO "authenticated"
  USING (is_admin());

DROP POLICY IF EXISTS "Admin can insert species" ON "public"."species";
CREATE POLICY "Admin can insert species" ON "public"."species"
  FOR INSERT TO "authenticated"
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin can update species" ON "public"."species";
CREATE POLICY "Admin can update species" ON "public"."species"
  FOR UPDATE TO "authenticated"
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Superadmin can update profiles" ON "public"."profiles";
CREATE POLICY "Superadmin can update profiles" ON "public"."profiles"
  FOR UPDATE TO "authenticated"
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- ── C. sync_subgroup ─────────────────────────────────────────────────────────

-- Cambia respecto de 038: la membresía sale de `is_plantation_member`, que exige
-- perfil activo. Con el EXISTS inline, un técnico inactivo seguía subiendo grupos.
CREATE OR REPLACE FUNCTION "public"."sync_subgroup"("p_subgroup" "jsonb", "p_trees" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_motivo TEXT;
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
