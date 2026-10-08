-- Un grupo nuevo a nombre de otro usuario lo suben solo admin y superadmin (#798).
--
-- `sync_subgroup` creaba el grupo con el `usuario_creador` del payload, sin
-- compararlo con `auth.uid()`: un técnico subía un grupo atribuido a otro (un
-- bug de la app o un APK viejo alcanzaba). `puede_escribir_grupo` no lo frena
-- porque el grupo todavía no existe. Ahora el técnico sube grupos nuevos solo a
-- su nombre. Admin y superadmin siguen subiendo el de otro con su creador real:
-- es el grupo que un técnico dejó sin subir en un celular compartido. Sin
-- creador, se rechaza para todos. Un grupo que ya existe sigue la regla de 072:
-- el upsert no pisa su creador.
--
-- Rollback: volver a correr `sync_subgroup_rechazo` de 072. No hay columnas ni
-- datos que deshacer. En el repo, el rollback borra también el test 57.

CREATE OR REPLACE FUNCTION "public"."sync_subgroup_rechazo"("p_subgroup" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_motivo TEXT;
BEGIN
  IF NOT is_plantation_member((p_subgroup->>'plantation_id')::UUID) THEN
    RETURN 'PERMISSION';
  END IF;

  v_motivo := motivo_no_escribible((p_subgroup->>'plantation_id')::UUID);
  IF v_motivo IS NOT NULL THEN
    RETURN v_motivo;
  END IF;

  IF EXISTS (
    SELECT 1 FROM groups
    WHERE id = (p_subgroup->>'id')::UUID
      AND (plantation_id <> (p_subgroup->>'plantation_id')::UUID
           OR parcela_id IS DISTINCT FROM (p_subgroup->>'parcela_id')::UUID)
  ) OR EXISTS (
    SELECT 1 FROM parcelas
    WHERE id = (p_subgroup->>'parcela_id')::UUID
      AND plantation_id <> (p_subgroup->>'plantation_id')::UUID
  ) THEN
    RETURN 'REFERENCIA_AJENA';
  END IF;

  IF NOT puede_escribir_grupo((p_subgroup->>'id')::UUID) THEN
    RETURN 'PERMISSION';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM groups WHERE id = (p_subgroup->>'id')::UUID)
     AND (p_subgroup->>'usuario_creador' IS NULL
          OR (NOT is_admin() AND (p_subgroup->>'usuario_creador')::UUID IS DISTINCT FROM auth.uid())) THEN
    RETURN 'PERMISSION';
  END IF;

  IF EXISTS (
    SELECT 1 FROM groups
    WHERE parcela_id = (p_subgroup->>'parcela_id')::UUID
      AND codigo = p_subgroup->>'codigo'
      AND id <> (p_subgroup->>'id')::UUID
  ) THEN
    RETURN 'DUPLICATE_CODE';
  END IF;

  IF EXISTS (
    SELECT 1 FROM groups
    WHERE parcela_id = (p_subgroup->>'parcela_id')::UUID
      AND nombre = p_subgroup->>'nombre'
      AND id <> (p_subgroup->>'id')::UUID
  ) THEN
    RETURN 'DUPLICATE_NAME';
  END IF;

  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."sync_subgroup_rechazo"("jsonb") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."sync_subgroup_rechazo"("jsonb") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."sync_subgroup_rechazo"("jsonb") TO "service_role";
