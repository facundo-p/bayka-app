-- `sincronizar_borrados` aplica la regla de escritura de #768: un técnico solo
-- borra lo suyo; admin y superadmin borran también lo ajeno (#796).
--
-- Hasta acá bastaba la membresía y la plantación escribible: un técnico
-- asignado borraba en el server el árbol o el grupo de otro (un bug de la app o
-- un APK viejo alcanzaba). Ahora pasa por `puede_escribir_grupo`, como
-- `sync_subgroup`.
--
-- En una plantación escribible, el id ajeno se saltea sin quedar en
-- `rechazados`, igual que en `quitar_fotos_arboles`: ahí quedaría pendiente en
-- el teléfono para siempre, y el pull ya devuelve la fila. En una no escribible
-- vuelve en `rechazados` como cualquier borrado.
--
-- Rollback: volver a correr `sincronizar_borrados` de 038. No hay columnas ni
-- datos que deshacer. En el repo, el rollback borra también el test 56.

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
  v_rechazos JSONB := '[]';
BEGIN
  SELECT array_agg((valor->>'id')::UUID) INTO v_arboles
  FROM jsonb_array_elements(p_borrados) AS b(valor) WHERE valor->>'tipo' = 'arbol';

  SELECT array_agg((valor->>'id')::UUID) INTO v_grupos
  FROM jsonb_array_elements(p_borrados) AS b(valor) WHERE valor->>'tipo' = 'grupo';

  -- Se calcula antes de borrar, mientras las filas todavía están.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', x.id, 'error', x.motivo)), '[]') INTO v_rechazos
  FROM (
    SELECT t.id, motivo_no_escribible(g.plantation_id) AS motivo
    FROM trees t JOIN groups g ON g.id = t.group_id
    WHERE v_arboles IS NOT NULL AND t.id = ANY(v_arboles)
    UNION ALL
    SELECT g.id, motivo_no_escribible(g.plantation_id)
    FROM groups g
    WHERE v_grupos IS NOT NULL AND g.id = ANY(v_grupos)
  ) AS x
  WHERE x.motivo IS NOT NULL;

  IF v_arboles IS NOT NULL THEN
    DELETE FROM trees t
    USING groups g
    WHERE t.id = ANY(v_arboles)
      AND g.id = t.group_id
      AND is_plantation_member(g.plantation_id)
      AND plantacion_escribible(g.plantation_id)
      AND puede_escribir_grupo(g.id);
    GET DIAGNOSTICS v_arboles_borrados = ROW_COUNT;
  END IF;

  IF v_grupos IS NOT NULL THEN
    DELETE FROM groups g
    WHERE g.id = ANY(v_grupos)
      AND is_plantation_member(g.plantation_id)
      AND plantacion_escribible(g.plantation_id)
      AND puede_escribir_grupo(g.id);
    GET DIAGNOSTICS v_grupos_borrados = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'arboles', v_arboles_borrados,
    'grupos', v_grupos_borrados,
    'rechazados', COALESCE((SELECT jsonb_agg(r->'id') FROM jsonb_array_elements(v_rechazos) AS r), '[]'),
    'rechazos', v_rechazos
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

ALTER FUNCTION "public"."sincronizar_borrados"("jsonb") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."sincronizar_borrados"("jsonb") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."sincronizar_borrados"("jsonb") TO "authenticated", "service_role";
