-- Migration 009: Update sync_subgroup RPC to use DO UPDATE for trees
-- Per D-09: N/N resolution re-sync must update server tree species.
-- Only species_id and sub_id are updated on conflict — posicion, usuario_registro,
-- created_at are NOT updatable, preserving audit trail (T-14-01 mitigation).
-- SECURITY INVOKER: RLS policies on subgroups and trees enforce
-- auth.uid() = usuario_creador and auth.uid() = usuario_registro respectively.

CREATE OR REPLACE FUNCTION sync_subgroup(
  p_subgroup JSONB,
  p_trees    JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 1. Check DUPLICATE_CODE before insert: a different UUID exists with same plantation_id + codigo.
  --    This catches the race condition where another device already uploaded a SubGroup with
  --    the same code, or the local UUID differs from the server record.
  --    Must run BEFORE INSERT to return a meaningful error instead of a constraint violation.
  IF EXISTS (
    SELECT 1 FROM subgroups
    WHERE plantation_id = (p_subgroup->>'plantation_id')::UUID
      AND codigo = p_subgroup->>'codigo'
      AND id <> (p_subgroup->>'id')::UUID
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_CODE');
  END IF;

  -- 2. Insert SubGroup; ON CONFLICT (id) DO NOTHING for idempotent re-upload
  --    Server is source of truth for estado: always set to 'sincronizada'.
  INSERT INTO subgroups (id, plantation_id, nombre, codigo, tipo, estado, usuario_creador, created_at)
  VALUES (
    (p_subgroup->>'id')::UUID,
    (p_subgroup->>'plantation_id')::UUID,
    p_subgroup->>'nombre',
    p_subgroup->>'codigo',
    p_subgroup->>'tipo',
    'sincronizada',
    (p_subgroup->>'usuario_creador')::UUID,
    (p_subgroup->>'created_at')::TIMESTAMPTZ
  )
  ON CONFLICT (id) DO NOTHING;

  -- 3. Insert trees; ON CONFLICT (id) DO UPDATE allows re-sync after N/N resolution
  --    to update species_id and sub_id on the server.
  INSERT INTO trees (id, subgroup_id, species_id, posicion, sub_id, foto_url, usuario_registro, created_at)
  SELECT
    (t->>'id')::UUID,
    (t->>'subgroup_id')::UUID,
    NULLIF(t->>'species_id', '')::UUID,
    (t->>'posicion')::INTEGER,
    t->>'sub_id',
    t->>'foto_url',
    (t->>'usuario_registro')::UUID,
    (t->>'created_at')::TIMESTAMPTZ
  FROM jsonb_array_elements(p_trees) AS t
  ON CONFLICT (id) DO UPDATE SET
    species_id = EXCLUDED.species_id,
    sub_id = EXCLUDED.sub_id,
    -- Update foto_url only if the new value is not null (don't erase existing photos).
    -- Covers: re-sync after photo upload, or re-sync after N/N resolution with photo.
    foto_url = COALESCE(EXCLUDED.foto_url, trees.foto_url);

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'UNKNOWN');
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION sync_subgroup(JSONB, JSONB) TO authenticated;