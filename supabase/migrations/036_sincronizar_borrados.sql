-- Los borrados locales de árboles y grupos nunca llegaban al server (#467): el
-- pull los resucitaba en la misma sincronización, y la renumeración dejaba SubIDs
-- duplicados que después subían.
--
-- Va por SECURITY DEFINER y no por un DELETE del cliente porque NO HAY policy de
-- DELETE sobre `trees` ni sobre `groups`: un delete por PostgREST sería un no-op
-- silencioso (la trampa de #319).
--
-- Borrado EXPLÍCITO por id, nunca "borrá todo lo que no te mandé". El device puede
-- tener un set parcial —un pull cortado, u otro técnico agregando árboles al mismo
-- grupo— y la semántica de reemplazo borraría datos ajenos sin que nadie se entere.
--
-- Los valores de `tipo` están duplicados en mobile/src/constants/entidadBorrada.ts;
-- SQL no puede importar la constante.
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
BEGIN
  SELECT array_agg((valor->>'id')::UUID) INTO v_arboles
  FROM jsonb_array_elements(p_borrados) AS b(valor) WHERE valor->>'tipo' = 'arbol';

  SELECT array_agg((valor->>'id')::UUID) INTO v_grupos
  FROM jsonb_array_elements(p_borrados) AS b(valor) WHERE valor->>'tipo' = 'grupo';

  -- La membresía se valida contra la plantación REAL de cada fila, no contra la que
  -- venga en el payload: el cliente no decide sobre qué puede borrar.
  IF v_arboles IS NOT NULL THEN
    DELETE FROM trees t
    USING groups g
    WHERE t.id = ANY(v_arboles)
      AND g.id = t.group_id
      AND is_plantation_member(g.plantation_id);
    GET DIAGNOSTICS v_arboles_borrados = ROW_COUNT;
  END IF;

  -- Después de los árboles: un grupo borrado se lleva los suyos por cascada, así
  -- que el orden inverso dejaría ids de árboles sin matchear (igual es no-op).
  IF v_grupos IS NOT NULL THEN
    DELETE FROM groups g
    WHERE g.id = ANY(v_grupos)
      AND is_plantation_member(g.plantation_id);
    GET DIAGNOSTICS v_grupos_borrados = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'arboles', v_arboles_borrados,
    'grupos', v_grupos_borrados
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

ALTER FUNCTION "public"."sincronizar_borrados"("jsonb") OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."sincronizar_borrados"("jsonb") TO "authenticated", "service_role";
