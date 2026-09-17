-- Migration 033: SELECT scoped por membresía de plantación / organización
-- (#310). Hasta acá cualquier autenticado leía todo; ahora solo ve lo suyo.

-- ── A. Helpers SECURITY DEFINER: corren como el owner de la tabla para que
--    las policies de profiles/plantation_users no se llamen recursivamente
--    entre sí (RLS no aplica al owner) ─────────────────────────────────────

CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND rol IN ('admin', 'superadmin')
  );
$$;

ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."is_admin"() TO "authenticated", "service_role";

CREATE OR REPLACE FUNCTION "public"."current_organizacion_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT organizacion_id FROM profiles WHERE id = auth.uid();
$$;

ALTER FUNCTION "public"."current_organizacion_id"() OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."current_organizacion_id"() TO "authenticated", "service_role";

CREATE OR REPLACE FUNCTION "public"."is_plantation_member"("p_plantation_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM plantation_users
    WHERE plantation_id = p_plantation_id AND user_id = auth.uid()
  );
$$;

ALTER FUNCTION "public"."is_plantation_member"("uuid") OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."is_plantation_member"("uuid") TO "authenticated", "service_role";

-- ── B. Policies SELECT: de USING(true) a scoped por membresía/organización ──

-- Un perfil activo sin organización dejaría de ver todo salvo su propia fila: se corrige el dato
-- antes de aplicar, no después.
DO $$
DECLARE v_sin_org integer;
BEGIN
  SELECT COUNT(*) INTO v_sin_org FROM public.profiles WHERE activo AND organizacion_id IS NULL;
  IF v_sin_org > 0 THEN
    RAISE EXCEPTION 'profiles: % perfil(es) activo(s) sin organizacion_id; asignar organización antes de aplicar 033', v_sin_org;
  END IF;
END;
$$;

DROP POLICY IF EXISTS "Authenticated can read all profiles" ON "public"."profiles";
CREATE POLICY "Members can read org profiles" ON "public"."profiles" FOR SELECT TO "authenticated"
  USING (organizacion_id = current_organizacion_id());
-- "Users can read own profile" (baseline) queda intacta: cubre al usuario sin
-- organizacion_id (o antes de que current_organizacion_id() resuelva algo).

DROP POLICY IF EXISTS "Authenticated users can read organizations" ON "public"."organizations";
CREATE POLICY "Members can read own organization" ON "public"."organizations" FOR SELECT TO "authenticated"
  USING (id = current_organizacion_id());

DROP POLICY IF EXISTS "Authenticated users can read plantations" ON "public"."plantations";
CREATE POLICY "Members can read plantations" ON "public"."plantations" FOR SELECT TO "authenticated"
  USING (is_plantation_member(id));

DROP POLICY IF EXISTS "Authenticated users can read parcelas" ON "public"."parcelas";
CREATE POLICY "Members can read parcelas" ON "public"."parcelas" FOR SELECT TO "authenticated"
  USING (is_plantation_member(plantation_id));

DROP POLICY IF EXISTS "Authenticated users can read plantation_species" ON "public"."plantation_species";
CREATE POLICY "Members can read plantation_species" ON "public"."plantation_species" FOR SELECT TO "authenticated"
  USING (is_plantation_member(plantation_id));

DROP POLICY IF EXISTS "Authenticated users can read plantation_users" ON "public"."plantation_users";
CREATE POLICY "Members can read plantation_users" ON "public"."plantation_users" FOR SELECT TO "authenticated"
  USING (is_plantation_member(plantation_id));

DROP POLICY IF EXISTS "Authenticated users can read subgroups" ON "public"."groups";
CREATE POLICY "Members can read subgroups" ON "public"."groups" FOR SELECT TO "authenticated"
  USING (is_plantation_member(plantation_id));

DROP POLICY IF EXISTS "Authenticated users can read trees" ON "public"."trees";
CREATE POLICY "Members can read trees" ON "public"."trees" FOR SELECT TO "authenticated"
  USING (EXISTS (
    SELECT 1 FROM groups g WHERE g.id = trees.group_id AND is_plantation_member(g.plantation_id)
  ));

-- species queda sin tocar: catálogo global, no es dato de organización.

-- ── C. Triggers de membresía admin, ahora acotados a la organización ────────

CREATE OR REPLACE FUNCTION "public"."add_admin_memberships_to_plantation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO plantation_users (plantation_id, user_id, rol_en_plantacion)
  SELECT NEW.id, pr.id, 'admin'
  FROM profiles pr
  WHERE pr.rol IN ('admin', 'superadmin') AND pr.activo
    AND pr.organizacion_id = NEW.organizacion_id
  ON CONFLICT (plantation_id, user_id) DO UPDATE
    SET rol_en_plantacion = 'admin';
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."add_admin_memberships_to_plantation"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."sync_admin_memberships_on_rol_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.rol IN ('admin', 'superadmin') AND NEW.activo THEN
    INSERT INTO plantation_users (plantation_id, user_id, rol_en_plantacion)
    SELECT p.id, NEW.id, 'admin'
    FROM plantations p
    WHERE p.organizacion_id = NEW.organizacion_id
    ON CONFLICT (plantation_id, user_id) DO UPDATE
      SET rol_en_plantacion = 'admin';
  ELSIF TG_OP = 'UPDATE'
        AND OLD.rol IN ('admin', 'superadmin')
        AND NEW.rol NOT IN ('admin', 'superadmin') THEN
    -- Degradado: pierde solo las membresías que le dio el rol global.
    DELETE FROM plantation_users
    WHERE user_id = NEW.id AND rol_en_plantacion = 'admin';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."sync_admin_memberships_on_rol_change"() OWNER TO "postgres";

-- Backfill: retira membresías admin que hoy cruzan organización (no-op en
-- staging/prod, ambos con una sola organización real hasta ahora).
DELETE FROM plantation_users pu
USING plantations p, profiles pr
WHERE pu.plantation_id = p.id
  AND pu.user_id = pr.id
  AND pu.rol_en_plantacion = 'admin'
  AND pr.organizacion_id IS DISTINCT FROM p.organizacion_id;

-- ── D. Storage: tree-photos, scoped por plantación (fail-closed en paths
--    malformados). El regex se repite dentro de un CASE en vez de encadenarlo
--    con AND: Postgres no garantiza cortocircuito en AND (sí en CASE), y un
--    path malformado casteado a uuid directamente tiraría una excepción en
--    vez de simplemente no matchear la policy.

DROP POLICY IF EXISTS "Authenticated users can upload tree photos" ON storage.objects;
CREATE POLICY "Members can upload tree photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tree-photos'
  AND (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND is_plantation_member((CASE WHEN (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN (storage.foldername(name))[2] ELSE NULL END)::uuid)
);

DROP POLICY IF EXISTS "Authenticated users can read tree photos" ON storage.objects;
CREATE POLICY "Members can read tree photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'tree-photos'
  AND (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND is_plantation_member((CASE WHEN (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN (storage.foldername(name))[2] ELSE NULL END)::uuid)
);

DROP POLICY IF EXISTS "Authenticated users can update tree photos" ON storage.objects;
CREATE POLICY "Members can update tree photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tree-photos'
  AND (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND is_plantation_member((CASE WHEN (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN (storage.foldername(name))[2] ELSE NULL END)::uuid)
);

DROP POLICY IF EXISTS "Admins can delete tree photos" ON storage.objects;
CREATE POLICY "Admins can delete tree photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'tree-photos'
  AND (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND is_admin()
);

-- ── E. Índice para is_plantation_member() (lookup por user_id) ──────────────

CREATE INDEX IF NOT EXISTS plantation_users_user_id_idx ON public.plantation_users (user_id);
