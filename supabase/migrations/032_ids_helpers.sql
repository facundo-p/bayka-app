-- Migration 032: helpers de estado/seed de global_id para la web (#309)
-- SECURITY INVOKER en plantation_ids_status: la web la llama directo y debe
-- respetar RLS; generate_tree_ids la usa desde su propio contexto DEFINER.

CREATE OR REPLACE FUNCTION "public"."plantation_ids_status"("p_plantation_id" "uuid")
RETURNS TABLE("total" integer, "con_id" integer, "generados" boolean)
LANGUAGE "sql" STABLE SECURITY INVOKER
AS $$
  SELECT
    COUNT(*)::integer,
    COUNT(t.global_id)::integer,
    COUNT(*) > 0 AND COUNT(*) = COUNT(t.global_id)
  FROM trees t
  JOIN groups g ON g.id = t.group_id
  WHERE g.plantation_id = p_plantation_id;
$$;

ALTER FUNCTION "public"."plantation_ids_status"("p_plantation_id" "uuid") OWNER TO "postgres";

-- global_id es único a nivel global (no por plantación): el seed debe leer
-- MAX(global_id) de TODAS las trees, igual que hacía generate_tree_ids inline.
CREATE OR REPLACE FUNCTION "public"."next_global_id_seed"()
RETURNS integer
LANGUAGE "sql" STABLE SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
  SELECT COALESCE(MAX(global_id), 0) + 1 FROM trees;
$$;

ALTER FUNCTION "public"."next_global_id_seed"() OWNER TO "postgres";

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
  -- Gate de rol: mismo predicado que las policies admin de 024.
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND rol IN ('admin', 'superadmin')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHORIZED');
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

GRANT EXECUTE ON FUNCTION "public"."plantation_ids_status"("p_plantation_id" "uuid") TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."next_global_id_seed"() TO "authenticated", "service_role";
