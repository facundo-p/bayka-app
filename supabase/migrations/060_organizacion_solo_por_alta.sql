-- La pertenencia a la organización se otorga en el alta administrada (#607).
--
-- `handle_new_user` corre en todo INSERT sobre `auth.users`, venga de donde
-- venga, y le asignaba la organización del MVP. Con el registro público
-- encendido (el default de Supabase, #606) cualquiera nacía adentro de la
-- organización del cliente.
--
-- Ahora el profile nace sin organización: `current_organizacion_id()` da NULL,
-- ninguna policy que compare contra ella matchea, y la web y la app lo muestran
-- como `sin-acceso`. La organización la asigna `admin-users` con service_role
-- después de invitar, junto con el rol.
--
-- Usuarios existentes: ya tienen organización, no hay backfill.

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- SIEMPRE 'tecnico' y sin organización: nada se toma de raw_user_meta_data,
  -- que en un signUp con la anon key controla el cliente.
  insert into public.profiles (id, nombre, rol, organizacion_id, email)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'nombre', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuario'
    ),
    'tecnico',
    null,
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";
