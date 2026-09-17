-- Las escrituras de admin quedan acotadas a la organización del que escribe (#543).
--
-- Hasta acá las policies de escritura de `plantations`, `plantation_species`,
-- `plantation_users` y `profiles` (superadmin) miraban solo el rol. Un admin de
-- otra organización podía, por PostgREST directo, asignarse en una plantación
-- ajena (y leerla vía `is_plantation_member`), quitarles el acceso a sus técnicos,
-- reemplazar sus especies, editarla o crearla a nombre de otra organización.
--
-- `parcelas`, `groups`, `trees` y Storage exigen membresía: con las asignaciones
-- acotadas, la membresía ya no se puede fabricar entre organizaciones. `species`
-- es un catálogo global sin organización y queda como está.
--
-- Las filas `admin` de `plantation_users` las mantienen los triggers de membresía
-- (SECURITY DEFINER, no pasan por RLS). Por PostgREST solo se asignan y quitan
-- técnicos, que es lo único que hacen la web y el móvil.

-- ── A. Helpers ───────────────────────────────────────────────────────────────

-- Una plantación inexistente no es de ninguna organización.
CREATE OR REPLACE FUNCTION "public"."plantacion_de_mi_organizacion"("p_plantation_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM plantations p
    WHERE p.id = p_plantation_id
      AND p.organizacion_id = current_organizacion_id()
  );
$$;

ALTER FUNCTION "public"."plantacion_de_mi_organizacion"("uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."plantacion_de_mi_organizacion"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."plantacion_de_mi_organizacion"("uuid") TO "authenticated", "service_role";

-- SECURITY DEFINER: la policy SELECT de profiles no debe decidir esta comparación.
CREATE OR REPLACE FUNCTION "public"."perfil_de_mi_organizacion"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles pr
    WHERE pr.id = p_user_id
      AND pr.organizacion_id = current_organizacion_id()
  );
$$;

ALTER FUNCTION "public"."perfil_de_mi_organizacion"("uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."perfil_de_mi_organizacion"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."perfil_de_mi_organizacion"("uuid") TO "authenticated", "service_role";

-- Misma regla que 045, con la organización en el helper.
CREATE OR REPLACE FUNCTION "public"."puede_archivar_plantacion"("p_plantation_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT is_admin() AND plantacion_de_mi_organizacion(p_plantation_id);
$$;

ALTER FUNCTION "public"."puede_archivar_plantacion"("uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."puede_archivar_plantacion"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."puede_archivar_plantacion"("uuid") TO "authenticated", "service_role";

-- ── B. plantations ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admin can insert plantations" ON "public"."plantations";
CREATE POLICY "Admin can insert plantations" ON "public"."plantations"
  FOR INSERT TO "authenticated"
  WITH CHECK (
    is_admin()
    AND plantations.organizacion_id = current_organizacion_id()
  );

-- El WITH CHECK también impide mover la plantación a otra organización.
DROP POLICY IF EXISTS "Admin can update plantations" ON "public"."plantations";
CREATE POLICY "Admin can update plantations" ON "public"."plantations"
  FOR UPDATE TO "authenticated"
  USING (
    is_admin()
    AND plantations.organizacion_id = current_organizacion_id()
    AND plantacion_escribible(plantations.id)
  )
  WITH CHECK (
    is_admin()
    AND plantations.organizacion_id = current_organizacion_id()
    AND plantations.archivada_en IS NULL
    AND plantations.archivada_por IS NULL
  );

-- ── C. plantation_species ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admin can insert plantation_species" ON "public"."plantation_species";
CREATE POLICY "Admin can insert plantation_species" ON "public"."plantation_species"
  FOR INSERT TO "authenticated"
  WITH CHECK (
    is_admin()
    AND plantacion_de_mi_organizacion(plantation_species.plantation_id)
    AND plantacion_escribible(plantation_species.plantation_id)
  );

DROP POLICY IF EXISTS "Admin can update plantation_species" ON "public"."plantation_species";
CREATE POLICY "Admin can update plantation_species" ON "public"."plantation_species"
  FOR UPDATE TO "authenticated"
  USING (
    is_admin()
    AND plantacion_de_mi_organizacion(plantation_species.plantation_id)
    AND plantacion_escribible(plantation_species.plantation_id)
  )
  WITH CHECK (
    is_admin()
    AND plantacion_de_mi_organizacion(plantation_species.plantation_id)
    AND plantacion_escribible(plantation_species.plantation_id)
  );

DROP POLICY IF EXISTS "Admin can delete plantation_species" ON "public"."plantation_species";
CREATE POLICY "Admin can delete plantation_species" ON "public"."plantation_species"
  FOR DELETE TO "authenticated"
  USING (
    is_admin()
    AND plantacion_de_mi_organizacion(plantation_species.plantation_id)
    AND plantacion_escribible(plantation_species.plantation_id)
  );

-- ── D. plantation_users ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admin can insert plantation_users" ON "public"."plantation_users";
CREATE POLICY "Admin can insert plantation_users" ON "public"."plantation_users"
  FOR INSERT TO "authenticated"
  WITH CHECK (
    is_admin()
    AND plantation_users.rol_en_plantacion = 'tecnico'
    AND plantacion_de_mi_organizacion(plantation_users.plantation_id)
    AND perfil_de_mi_organizacion(plantation_users.user_id)
    AND plantacion_admite_asignaciones(plantation_users.plantation_id)
  );

DROP POLICY IF EXISTS "Admin can delete plantation_users" ON "public"."plantation_users";
CREATE POLICY "Admin can delete plantation_users" ON "public"."plantation_users"
  FOR DELETE TO "authenticated"
  USING (
    is_admin()
    AND plantation_users.rol_en_plantacion = 'tecnico'
    AND plantacion_de_mi_organizacion(plantation_users.plantation_id)
    AND plantacion_admite_asignaciones(plantation_users.plantation_id)
  );

-- ── E. profiles ──────────────────────────────────────────────────────────────

-- Un superadmin gestiona los perfiles de su organización, que son los únicos que
-- lee. El WITH CHECK impide sacar a alguien de la organización.
DROP POLICY IF EXISTS "Superadmin can update profiles" ON "public"."profiles";
CREATE POLICY "Superadmin can update profiles" ON "public"."profiles"
  FOR UPDATE TO "authenticated"
  USING (
    is_superadmin()
    AND profiles.organizacion_id = current_organizacion_id()
  )
  WITH CHECK (
    is_superadmin()
    AND profiles.organizacion_id = current_organizacion_id()
  );
