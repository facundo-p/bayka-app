-- Asignar o quitar técnicos exige que la plantación exista y no esté archivada (#522).
--
-- `plantation_species` ya lo exige desde 037/038 con `plantacion_escribible`, pero
-- `plantation_users` solo miraba el rol: se podían tocar las asignaciones de una
-- archivada, que es de solo lectura para todos, y una plantación borrada fallaba
-- por FK (23503) en vez de por RLS.
--
-- Una finalizada sí admite asignaciones: las membresías son control de acceso, no
-- datos de campo, y la web permite gestionarlas. Por eso no alcanza con
-- `plantacion_escribible`, que la bloquearía para un admin.
--
-- Los triggers de membresía admin son SECURITY DEFINER y el cascade de
-- `eliminar_plantacion` es de FK: ninguno pasa por estas policies.

CREATE OR REPLACE FUNCTION "public"."plantacion_admite_asignaciones"("p_plantation_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT coalesce(motivo_no_escribible(p_plantation_id), '')
    NOT IN ('PLANTACION_INEXISTENTE', 'PLANTACION_ARCHIVADA');
$$;

ALTER FUNCTION "public"."plantacion_admite_asignaciones"("uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."plantacion_admite_asignaciones"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."plantacion_admite_asignaciones"("uuid") TO "authenticated", "service_role";

DROP POLICY IF EXISTS "Admin can insert plantation_users" ON "public"."plantation_users";
CREATE POLICY "Admin can insert plantation_users" ON "public"."plantation_users"
  FOR INSERT TO "authenticated"
  WITH CHECK (
    is_admin()
    AND plantacion_admite_asignaciones(plantation_users.plantation_id)
  );

DROP POLICY IF EXISTS "Admin can delete plantation_users" ON "public"."plantation_users";
CREATE POLICY "Admin can delete plantation_users" ON "public"."plantation_users"
  FOR DELETE TO "authenticated"
  USING (
    is_admin()
    AND plantacion_admite_asignaciones(plantation_users.plantation_id)
  );
