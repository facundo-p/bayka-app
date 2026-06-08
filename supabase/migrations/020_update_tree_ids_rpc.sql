-- Migration 020: RPC dedicado para persistir IDs generados (plantacion_id / global_id)
-- en el MISMO paso en que se generan, sin re-subir grupos/árboles completos.
--
-- "Generar IDs" (acción de admin, requiere conexión) asigna los IDs definitivos en
-- SQLite local y los persiste inmediatamente con este RPC. Es un bulk UPDATE liviano
-- (solo dos columnas por árbol) vs. re-pushear todo el grupo vía sync_subgroup.
--
-- Los árboles ya existen en el server (sus grupos se sincronizaron antes). Este RPC
-- solo actualiza plantacion_id/global_id por id. Devuelve cuántas filas tocó, para
-- que el cliente detecte si algún árbol no estaba en el server (updated < enviados).

CREATE OR REPLACE FUNCTION update_tree_ids(p_ids JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  WITH data AS (
    SELECT * FROM jsonb_to_recordset(p_ids)
      AS x(id UUID, plantacion_id INTEGER, global_id INTEGER)
  )
  UPDATE trees t
  SET plantacion_id = d.plantacion_id,
      global_id = d.global_id
  FROM data d
  WHERE t.id = d.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'updated', v_updated);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'UNKNOWN');
END;
$$;

GRANT EXECUTE ON FUNCTION update_tree_ids(JSONB) TO authenticated;
