-- generate_tree_ids (#495): exige la organización de la plantación y rechaza
-- archivadas. Hasta acá solo pedía rol admin global, y como es SECURITY DEFINER
-- sin RLS, un admin de otra organización podía numerar árboles ajenos.
--
-- Una finalizada SÍ genera IDs: es el flujo normal, se generan después de
-- finalizar. Por eso no alcanza con `plantacion_escribible` y se mira solo el
-- motivo de archivada.
--
-- Formato de respuesta sin cambios: `{ success, error }` / `{ success, updated, seed }`.

CREATE OR REPLACE FUNCTION "public"."generate_tree_ids"("p_plantation_id" "uuid", "p_seed" integer DEFAULT NULL::integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_total INTEGER;
  v_con_id INTEGER;
  v_seed INTEGER;
  v_updated INTEGER;
BEGIN
  -- Mismo predicado que `puede_archivar_plantacion` (038). Plantación inexistente
  -- o ajena dan el mismo error: no se filtra su existencia.
  IF NOT EXISTS (
    SELECT 1 FROM profiles pr
    JOIN plantations p ON p.organizacion_id = pr.organizacion_id
    WHERE pr.id = auth.uid()
      AND pr.activo
      AND pr.rol = ANY (ARRAY['admin', 'superadmin'])
      AND p.id = p_plantation_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;

  -- Bloquea la fila contra un archivado concurrente: si se archivó antes, el
  -- chequeo de abajo ya lo ve; si no, el archivado espera a que esto termine.
  PERFORM 1 FROM plantations WHERE id = p_plantation_id FOR SHARE;

  IF motivo_no_escribible(p_plantation_id) = 'PLANTACION_ARCHIVADA' THEN
    RETURN jsonb_build_object('success', false, 'error', 'PLANTACION_ARCHIVADA');
  END IF;

  -- Serializa generaciones concurrentes: el seed por defecto lee MAX(global_id)
  -- de TODAS las trees; dos corridas en paralelo duplicarían rangos.
  PERFORM pg_advisory_xact_lock(hashtext('generate_tree_ids'));

  SELECT total, con_id INTO v_total, v_con_id FROM plantation_ids_status(p_plantation_id);

  IF v_total = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_TREES');
  END IF;

  -- Idempotencia: cuenta como generado solo si TODOS tienen global_id. Un set
  -- parcial (sync incompleto) se regenera completo, igual que hacía mobile.
  IF v_con_id = v_total THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_GENERATED');
  END IF;

  v_seed := COALESCE(p_seed, next_global_id_seed());
  IF v_seed < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_SEED');
  END IF;

  WITH ordenados AS (
    SELECT t2.id,
           ROW_NUMBER() OVER (ORDER BY g.created_at ASC, t2.posicion ASC, g.id ASC) AS rn
    FROM trees t2
    JOIN groups g ON g.id = t2.group_id
    WHERE g.plantation_id = p_plantation_id
  )
  UPDATE trees t
  SET plantacion_id = o.rn,
      global_id = v_seed + o.rn - 1
  FROM ordenados o
  WHERE t.id = o.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'updated', v_updated, 'seed', v_seed);
END;
$$;

ALTER FUNCTION "public"."generate_tree_ids"("p_plantation_id" "uuid", "p_seed" integer) OWNER TO "postgres";
