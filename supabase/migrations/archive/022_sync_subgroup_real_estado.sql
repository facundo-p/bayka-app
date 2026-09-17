-- Migration 022: sync_subgroup persiste el estado REAL del grupo (no hardcode)
--
-- Bug: el RPC insertaba `estado = 'finalizada'` hardcodeado (mig 012→018→019),
-- ignorando el estado real. Un grupo 'activa' sincronizado quedaba 'finalizada'
-- en el server (corrupción de estado). Además el INSERT hacía
-- `ON CONFLICT (id) DO NOTHING`, así que tras el primer push el estado NUNCA se
-- actualizaba (activa→finalizada posterior no propagaba).
--
-- Fix:
--   * estado = el valor del payload (`p_subgroup->>'estado'`), normalizado al
--     CHECK del server. El CHECK de groups solo permite ('activa','finalizada')
--     (mig 014 quitó 'sincronizada', que es un flag SOLO-cliente). Cualquier
--     valor fuera del CHECK (incl. 'sincronizada' o ausente en clientes viejos)
--     degrada a 'finalizada' — backward-compatible con el comportamiento previo.
--   * ON CONFLICT (id) DO UPDATE SET estado: las transiciones de estado posteriores
--     al primer push ahora se propagan.
--
-- Body idéntico a 019 salvo esas dos líneas (scope DUPLICATE_CODE per-parcela,
-- parcela_id desde JSON, trees con plantacion_id/global_id + COALESCE,
-- SECURITY DEFINER — todo preservado).

CREATE OR REPLACE FUNCTION sync_subgroup(
  p_subgroup JSONB,
  p_trees    JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM groups
    WHERE parcela_id = (p_subgroup->>'parcela_id')::UUID
      AND codigo = p_subgroup->>'codigo'
      AND id <> (p_subgroup->>'id')::UUID
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_CODE');
  END IF;

  INSERT INTO groups (id, plantation_id, parcela_id, nombre, codigo, tipo, estado, usuario_creador, created_at)
  VALUES (
    (p_subgroup->>'id')::UUID,
    (p_subgroup->>'plantation_id')::UUID,
    (p_subgroup->>'parcela_id')::UUID,
    p_subgroup->>'nombre',
    p_subgroup->>'codigo',
    p_subgroup->>'tipo',
    CASE WHEN p_subgroup->>'estado' IN ('activa', 'finalizada')
         THEN p_subgroup->>'estado'
         ELSE 'finalizada' END,
    (p_subgroup->>'usuario_creador')::UUID,
    (p_subgroup->>'created_at')::TIMESTAMPTZ
  )
  ON CONFLICT (id) DO UPDATE SET
    estado = EXCLUDED.estado;

  INSERT INTO trees (
    id, group_id, species_id, posicion, sub_id, foto_url,
    plantacion_id, global_id, usuario_registro, created_at
  )
  SELECT
    (t->>'id')::UUID,
    COALESCE((t->>'group_id')::UUID, (t->>'subgroup_id')::UUID),
    NULLIF(t->>'species_id', '')::UUID,
    (t->>'posicion')::INTEGER,
    t->>'sub_id',
    t->>'foto_url',
    (t->>'plantacion_id')::INTEGER,
    (t->>'global_id')::INTEGER,
    (t->>'usuario_registro')::UUID,
    (t->>'created_at')::TIMESTAMPTZ
  FROM jsonb_array_elements(p_trees) AS t
  ON CONFLICT (id) DO UPDATE SET
    species_id = EXCLUDED.species_id,
    sub_id = EXCLUDED.sub_id,
    -- Conservar valores existentes si el push trae NULL (no erase de fotos ni IDs).
    foto_url = COALESCE(EXCLUDED.foto_url, trees.foto_url),
    plantacion_id = COALESCE(EXCLUDED.plantacion_id, trees.plantacion_id),
    global_id = COALESCE(EXCLUDED.global_id, trees.global_id);

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'UNKNOWN');
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION sync_subgroup(JSONB, JSONB) TO authenticated;
