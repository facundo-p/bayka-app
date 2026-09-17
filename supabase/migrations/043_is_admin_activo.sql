-- is_admin() exige perfil activo (#506), igual que puede_editar_finalizada().
-- El ban en Auth corta el refresh, pero el access token emitido antes del ban
-- sigue vigente hasta expirar, y una desactivación por SQL directo no banea.
-- Nadie depende de que un admin inactivo pase: la edge function usa
-- service_role, que no evalúa RLS, y los triggers de membresía ya exigen activo.

CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND activo
      AND rol IN ('admin', 'superadmin')
  );
$$;

ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."is_admin"() TO "authenticated", "service_role";
