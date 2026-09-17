-- Migration 019: unicidad del código de grupo per-parcela en sync_subgroup
-- Issue A: el RPC chequeaba DUPLICATE_CODE por (plantation_id, codigo) — el scope
-- VIEJO (pre-Phase 16). Desde migración 012 la constraint real es
-- groups_parcela_codigo_unique (parcela_id, codigo): el código de grupo es único
-- POR PARCELA, no por plantación, y puede repetirse entre parcelas.
--
-- La consolidación v1.1 (mig 014) fusionó N plantaciones origen como N parcelas
-- dentro de una destino, así que legítimamente hay hasta 17 grupos "L1" (uno por
-- parcela). Un re-push los hacía chocar entre sí → DUPLICATE_CODE falso → fallaban
-- todos los grupos.
--
-- Body idéntico a la versión vigente (018) salvo:
--   * Check DUPLICATE_CODE: scope por parcela_id en vez de plantation_id (espeja
--     groups_parcela_codigo_unique). Con parcela_id NULL el `= NULL` nunca es true
--     → no hay falso positivo, igual que el índice único trata los NULLs.
--   * INSERT groups: agrega la columna parcela_id desde el JSON (cierra el gap:
--     hoy los grupos nuevos quedaban con parcela_id NULL).
-- Se preserva TODO lo demás de 018 (trees con plantacion_id/global_id + COALESCE,
-- estado 'finalizada', group_id COALESCE subgroup_id, SECURITY DEFINER).

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
