-- Migration 018: persist generated tree IDs (plantacion_id / global_id) via sync_subgroup
-- Issue #55: los IDs definitivos generados al finalizar (semilla) se asignaban solo
-- en SQLite local y nunca llegaban al server porque el RPC los ignoraba.
--
-- La tabla trees YA tiene las columnas plantacion_id / global_id (001_initial_schema).
-- Solo hace falta que el RPC las inserte y las actualice on-conflict.
--
-- Body idéntico a la versión vigente (014) salvo:
--   * INSERT trees: agrega columnas plantacion_id, global_id (desde el JSON).
--   * DO UPDATE: agrega plantacion_id/global_id con COALESCE — un push sin IDs
--     (árbol aún no finalizado) NO debe pisar un valor ya persistido. Igual que foto_url.
-- Se preservan: tabla groups, group_id (COALESCE con subgroup_id para clientes viejos),
-- estado 'finalizada', SECURITY DEFINER.

CREATE OR REPLACE FUNCTION sync_subgroup(
  p_subgroup JSONB,
  p_trees    JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM groups
    WHERE plantation_id = (p_subgroup->>'plantation_id')::UUID
      AND codigo = p_subgroup->>'codigo'
      AND id <> (p_subgroup->>'id')::UUID
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_CODE');
  END IF;

  INSERT INTO groups (id, plantation_id, nombre, codigo, tipo, estado, usuario_creador, created_at)
  VALUES (
    (p_subgroup->>'id')::UUID,
    (p_subgroup->>'plantation_id')::UUID,
    p_subgroup->>'nombre',
    p_subgroup->>'codigo',
    p_subgroup->>'tipo',
    'finalizada',
    (p_subgroup->>'usuario_creador')::UUID,
    (p_subgroup->>'created_at')::TIMESTAMPTZ
  )
  ON CONFLICT (id) DO NOTHING;

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
