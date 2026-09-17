-- Eliminación lógica de usuarios con datos de campo (#479). Un usuario con árboles,
-- grupos o plantaciones a su nombre no se puede borrar de auth.users (las FKs lo
-- impiden a propósito): la edge function admin-users lo banea para siempre, libera
-- su email y marca eliminado_en. Es irreversible; el nombre queda para el historial.

ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "eliminado_en" timestamp with time zone;

-- Un eliminado nunca está activo: los triggers de membresía admin filtran por activo,
-- así que esto también garantiza que no reciba membresías nuevas.
ALTER TABLE "public"."profiles" DROP CONSTRAINT IF EXISTS "profiles_eliminado_inactivo";
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_eliminado_inactivo"
  CHECK ("eliminado_en" IS NULL OR NOT "activo");

CREATE OR REPLACE FUNCTION "public"."protect_profile_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  editor_es_superadmin boolean;
begin
  -- Conexiones sin usuario (service_role / dashboard / edge function): permitidas.
  if auth.uid() is null then
    return new;
  end if;
  if new.activo is distinct from old.activo
     or new.email is distinct from old.email
     or new.eliminado_en is distinct from old.eliminado_en then
    raise exception 'El email y el estado de un usuario solo se cambian desde la gestión de usuarios';
  end if;
  if new.rol is distinct from old.rol then
    editor_es_superadmin := exists (
      select 1 from profiles
      where id = auth.uid() and rol = 'superadmin' and activo
    );
    if not editor_es_superadmin then
      raise exception 'Solo un superadmin puede cambiar roles';
    end if;
    if old.id = auth.uid() and old.rol = 'superadmin' and new.rol <> 'superadmin' then
      raise exception 'Un superadmin no puede degradarse a sí mismo';
    end if;
  end if;
  return new;
end;
$$;

ALTER FUNCTION "public"."protect_profile_fields"() OWNER TO "postgres";
