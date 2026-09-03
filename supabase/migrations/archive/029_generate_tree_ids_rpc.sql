-- Migration 029: RPC transaccional para generar los IDs finales desde la web (issue #232).
--
-- Se invierte el flujo de "Generar IDs": deja de ser una acción de mobile
-- (algoritmo local en SQLite + update_tree_ids) y pasa a ejecutarse SOLO desde
-- la web de gestión con este RPC server-side. La app recibe los IDs por el pull
-- normal (el upsert de trees adopta plantacion_id/global_id si el local está vacío).
--
-- DEPRECACIÓN: `update_tree_ids` (020) queda vigente solo por back-compat con
-- APKs viejos que aún generan IDs localmente; no usar en código nuevo.
--
-- NOTA numeración: asume que 028 (issue #67, PR paralelo) entra antes;
-- renumerar este archivo si no.
--
-- Numeración idéntica al algoritmo que usaba mobile: árboles de la plantación
-- ordenados por groups.created_at ASC, trees.posicion ASC (groups.id como
-- desempate determinístico); plantacion_id = fila (1..N),
-- global_id = seed + fila - 1.
--
-- Sin handler EXCEPTION: un error real sube como error de Postgres con su
-- SQLSTATE (no se traga el detalle). Los códigos del payload
-- ({'success': false, 'error': ...}) son solo errores de negocio esperados.

CREATE OR REPLACE FUNCTION generate_tree_ids(
  p_plantation_id UUID,
  p_seed INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
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

  SELECT COUNT(*), COUNT(t.global_id)
  INTO v_total, v_con_id
  FROM trees t
  JOIN groups g ON g.id = t.group_id
  WHERE g.plantation_id = p_plantation_id;

  IF v_total = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_TREES');
  END IF;

  -- Idempotencia: cuenta como generado solo si TODOS tienen global_id. Un set
  -- parcial (sync incompleto) se regenera completo, igual que hacía mobile.
  IF v_con_id = v_total THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_GENERATED');
  END IF;

  v_seed := COALESCE(p_seed, (SELECT COALESCE(MAX(global_id), 0) + 1 FROM trees));
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

GRANT EXECUTE ON FUNCTION generate_tree_ids(UUID, INTEGER) TO authenticated;
