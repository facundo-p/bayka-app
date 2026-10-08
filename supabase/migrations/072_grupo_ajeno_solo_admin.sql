-- En un grupo que ya existe y creó otro usuario, solo escriben admin y superadmin (#768).
--
-- Hasta acá bastaba la membresía y la plantación escribible: cualquier técnico
-- asignado reemplazaba fotos y pisaba estado, nombre, SubID y GPS del grupo de
-- otro con su copia local (un bug de la app o un APK viejo alcanzaba). Un técnico
-- escribe solo en los grupos que creó; un grupo que todavía no existe lo crea
-- quien lo sube. Membresía, plantación escribible y misma plantación y parcela
-- (#732) siguen igual.
--
-- La regla vive en `puede_escribir_grupo` y la aplican:
-- - `sync_subgroup_rechazo`: PERMISSION, sin escribir nada.
-- - Las policies de INSERT y UPDATE de `trees`.
-- - `quitar_fotos_arboles`: saltea los árboles de un grupo ajeno.
-- - Las policies de INSERT y UPDATE de `tree-photos`: el archivo se llama
--   `<id del árbol>.jpg`, y el árbol, si existe, dice el grupo.
--
-- Rollback: volver a correr `sync_subgroup_rechazo` de 066, `quitar_fotos_arboles`
-- de 061, las policies de `trees` de 037 y las de Storage de 046, y después
-- `DROP FUNCTION` de `puede_escribir_foto`, `arbol_de_foto` y
-- `puede_escribir_grupo`. No hay columnas ni datos que deshacer. En el repo, el
-- rollback borra también el test 55.

-- ── A. Helpers ───────────────────────────────────────────────────────────────

-- SECURITY DEFINER: las policies lo evalúan como el usuario, y la RLS de `groups`
-- no le muestra a todos el grupo que tiene que mirar.
CREATE OR REPLACE FUNCTION "public"."puede_escribir_grupo"("p_group_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT is_admin() OR NOT EXISTS (
    SELECT 1 FROM groups
    WHERE id = p_group_id
      AND usuario_creador IS DISTINCT FROM auth.uid()
  );
$$;

ALTER FUNCTION "public"."puede_escribir_grupo"("uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."puede_escribir_grupo"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."puede_escribir_grupo"("uuid") TO "authenticated", "service_role";

-- El id del árbol de un objeto de `tree-photos`, o NULL si el archivo no se llama así.
CREATE OR REPLACE FUNCTION "public"."arbol_de_foto"("p_name" "text") RETURNS "uuid"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT substring(p_name FROM '(?:^|/)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.[^/]*$')::uuid;
$$;

ALTER FUNCTION "public"."arbol_de_foto"("text") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."arbol_de_foto"("text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."arbol_de_foto"("text") TO "authenticated", "service_role";

-- Un archivo que no es de un árbol existente no pisa nada ajeno: lo frenan, si
-- corresponde, la membresía y el estado de la plantación del path.
CREATE OR REPLACE FUNCTION "public"."puede_escribir_foto"("p_name" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM trees
    WHERE id = arbol_de_foto(p_name)
      AND NOT puede_escribir_grupo(group_id)
  );
$$;

ALTER FUNCTION "public"."puede_escribir_foto"("text") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."puede_escribir_foto"("text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."puede_escribir_foto"("text") TO "authenticated", "service_role";

-- ── B. sync_subgroup ─────────────────────────────────────────────────────────

-- Igual a 066 salvo el chequeo del creador, después de REFERENCIA_AJENA: un grupo
-- de otra plantación o parcela sigue respondiendo eso.
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

-- ── C. trees ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Plantation members can insert trees" ON "public"."trees";
CREATE POLICY "Plantation members can insert trees" ON "public"."trees"
  FOR INSERT TO "authenticated"
  WITH CHECK (EXISTS (
    SELECT 1 FROM groups sg
    WHERE sg.id = trees.group_id
      AND is_plantation_member(sg.plantation_id)
      AND plantacion_escribible(sg.plantation_id)
      AND puede_escribir_grupo(sg.id)
  ));

DROP POLICY IF EXISTS "Plantation members can update trees" ON "public"."trees";
CREATE POLICY "Plantation members can update trees" ON "public"."trees"
  FOR UPDATE TO "authenticated"
  USING (EXISTS (
    SELECT 1 FROM groups sg
    WHERE sg.id = trees.group_id
      AND is_plantation_member(sg.plantation_id)
      AND plantacion_escribible(sg.plantation_id)
      AND puede_escribir_grupo(sg.id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM groups sg
    WHERE sg.id = trees.group_id
      AND is_plantation_member(sg.plantation_id)
      AND plantacion_escribible(sg.plantation_id)
      AND puede_escribir_grupo(sg.id)
  ));

-- ── D. quitar_fotos_arboles ──────────────────────────────────────────────────

-- Igual a 061 salvo el grupo ajeno, que se saltea como un árbol de otra
-- plantación: no queda en `rechazados`, porque reabrir la plantación no lo
-- destraba, y el pull trae la foto del server.
CREATE OR REPLACE FUNCTION "public"."quitar_fotos_arboles"("p_arboles" "uuid"[])
RETURNS "jsonb"
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_quitadas INT := 0;
  v_rechazados UUID[] := '{}';
BEGIN
  SELECT COALESCE(array_agg(t.id), '{}') INTO v_rechazados
  FROM trees t JOIN groups g ON g.id = t.group_id
  WHERE t.id = ANY(p_arboles)
    AND NOT plantacion_escribible(g.plantation_id);

  WITH a_quitar AS (
    SELECT t.id, t.foto_url, g.plantation_id
    FROM trees t JOIN groups g ON g.id = t.group_id
    WHERE t.id = ANY(p_arboles)
      AND t.foto_url IS NOT NULL
      AND is_plantation_member(g.plantation_id)
      AND plantacion_escribible(g.plantation_id)
      AND puede_escribir_grupo(g.id)
    FOR UPDATE OF t
  ), quitadas AS (
    UPDATE trees t
    SET foto_url = NULL
    FROM a_quitar q
    WHERE t.id = q.id
    RETURNING t.id
  ), registradas AS (
    INSERT INTO fotos_quitadas (storage_path, tree_id, plantation_id, quitada_por)
    SELECT path_foto_storage(q.foto_url), q.id, q.plantation_id, auth.uid()
    FROM a_quitar q
    WHERE path_foto_storage(q.foto_url) IS NOT NULL
  )
  SELECT count(*) INTO v_quitadas FROM quitadas;

  RETURN jsonb_build_object(
    'success', true,
    'quitadas', v_quitadas,
    'rechazados', to_jsonb(v_rechazados)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

ALTER FUNCTION "public"."quitar_fotos_arboles"("uuid"[]) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."quitar_fotos_arboles"("uuid"[]) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."quitar_fotos_arboles"("uuid"[]) TO "authenticated", "service_role";

-- ── E. Storage ───────────────────────────────────────────────────────────────

-- Iguales a 046 salvo `puede_escribir_foto`. El móvil sube con upsert, que pasa
-- por INSERT y UPDATE: van las dos.
DROP POLICY IF EXISTS "Members can upload tree photos" ON storage.objects;
CREATE POLICY "Members can upload tree photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tree-photos'
  AND (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND is_plantation_member((CASE WHEN (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN (storage.foldername(name))[2] ELSE NULL END)::uuid)
  AND plantacion_escribible((CASE WHEN (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN (storage.foldername(name))[2] ELSE NULL END)::uuid)
  AND puede_escribir_foto(name)
);

DROP POLICY IF EXISTS "Members can update tree photos" ON storage.objects;
CREATE POLICY "Members can update tree photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tree-photos'
  AND (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND is_plantation_member((CASE WHEN (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN (storage.foldername(name))[2] ELSE NULL END)::uuid)
  AND plantacion_escribible((CASE WHEN (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN (storage.foldername(name))[2] ELSE NULL END)::uuid)
  AND puede_escribir_foto(name)
);
