-- Migration 012: Parcelas table + rename subgroups→groups + RLS + RPC update
-- Per Phase 15 (v1.1) — applied during coordinated window (D-01).
-- Atomic via BEGIN..COMMIT — Postgres DDL is transactional.
-- Companion: 013_data_consolidation.sql (run AFTER 012 commits successfully).

BEGIN;

-- ============================================================================
-- 1. Crear tabla parcelas (PARC-02, PARC-03)
-- ============================================================================
CREATE TABLE parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plantation_id uuid NOT NULL REFERENCES plantations(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  codigo text NOT NULL,
  descripcion text,
  pending_sync boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parcelas_plantation_nombre_unique UNIQUE (plantation_id, nombre),
  CONSTRAINT parcelas_plantation_codigo_unique UNIQUE (plantation_id, codigo),
  CONSTRAINT parcelas_descripcion_length CHECK (char_length(descripcion) <= 10000)
);

-- ============================================================================
-- 2. Rename subgroups → groups (PARC-04 server side / PARC-05)
-- ============================================================================
ALTER TABLE subgroups RENAME TO groups;

-- 3. FK constraint en groups (rename automático no garantizado en todas las versiones)
ALTER TABLE groups
  DROP CONSTRAINT IF EXISTS subgroups_plantation_id_fkey;
ALTER TABLE groups
  ADD CONSTRAINT groups_plantation_id_fkey
    FOREIGN KEY (plantation_id) REFERENCES plantations(id) ON DELETE CASCADE;

-- ============================================================================
-- 4. Agregar columna parcela_id a groups (PARC-06) — NULL por defecto
-- ============================================================================
ALTER TABLE groups ADD COLUMN parcela_id uuid REFERENCES parcelas(id);

-- ============================================================================
-- 5. Swap unique indexes a per-parcela (PARC-09)
-- ============================================================================
-- DROP unique constraints viejos per-plantation. Postgres puede haber renombrado
-- automáticamente al renombrar la tabla; usamos IF EXISTS para ambos nombres posibles.
ALTER TABLE groups DROP CONSTRAINT IF EXISTS subgroups_plantation_id_codigo_key;
ALTER TABLE groups DROP CONSTRAINT IF EXISTS subgroups_plantation_id_nombre_key;
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_plantation_id_codigo_key;
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_plantation_id_nombre_key;

CREATE UNIQUE INDEX groups_parcela_codigo_unique ON groups (parcela_id, codigo);
CREATE UNIQUE INDEX groups_parcela_nombre_unique ON groups (parcela_id, nombre);

-- ============================================================================
-- 6. Tipo CHECK: remover 'parcela', agregar 'bosquete' (PARC-07)
-- ============================================================================
ALTER TABLE groups DROP CONSTRAINT IF EXISTS subgroups_tipo_check;
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_tipo_check;
ALTER TABLE groups ADD CONSTRAINT groups_tipo_check CHECK (tipo IN ('linea', 'bosquete'));

-- NOTE: estado CHECK ('sincronizada' removal) lives in 013 AFTER the UPDATE
-- normalizacion. Doing it here would violate constraint during the UPDATE
-- (Pitfall 7).

-- ============================================================================
-- 7. Rename trees.subgroup_id → trees.group_id (PARC-05)
-- ============================================================================
ALTER TABLE trees RENAME COLUMN subgroup_id TO group_id;

ALTER TABLE trees DROP CONSTRAINT IF EXISTS trees_subgroup_id_fkey;
ALTER TABLE trees
  ADD CONSTRAINT trees_group_id_fkey
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;

-- ============================================================================
-- 8. RECREAR RLS policies de trees (Pitfall 2 — referencias a subgroups/subgroup_id)
-- ============================================================================
DROP POLICY IF EXISTS "Plantation members can update trees" ON trees;
CREATE POLICY "Plantation members can update trees"
ON trees FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM groups sg
    JOIN plantation_users pu ON pu.plantation_id = sg.plantation_id
    WHERE sg.id = trees.group_id
    AND pu.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM groups sg
    JOIN plantation_users pu ON pu.plantation_id = sg.plantation_id
    WHERE sg.id = trees.group_id
    AND pu.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Plantation members can insert trees" ON trees;
CREATE POLICY "Plantation members can insert trees"
ON trees FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM groups sg
    JOIN plantation_users pu ON pu.plantation_id = sg.plantation_id
    WHERE sg.id = group_id
    AND pu.user_id = auth.uid()
  )
);

-- ============================================================================
-- 9. RECREAR RPC sync_subgroup (Pitfall 3 — referenciaba `subgroups` y `subgroup_id`)
-- ============================================================================
-- Body identico al de 009 pero con `groups` en lugar de `subgroups` y `group_id`
-- en lugar de `subgroup_id`. Nombre de la función se mantiene `sync_subgroup` para
-- no romper el call site del cliente (Phase 16 lo renombra junto con el cliente).
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
    'sincronizada',
    (p_subgroup->>'usuario_creador')::UUID,
    (p_subgroup->>'created_at')::TIMESTAMPTZ
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO trees (id, group_id, species_id, posicion, sub_id, foto_url, usuario_registro, created_at)
  SELECT
    (t->>'id')::UUID,
    (t->>'group_id')::UUID,
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
    foto_url = COALESCE(EXCLUDED.foto_url, trees.foto_url);

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'UNKNOWN');
END;
$$;

GRANT EXECUTE ON FUNCTION sync_subgroup(JSONB, JSONB) TO authenticated;

-- NOTE: el cliente actual (pre-P16) envía `subgroup_id` en el JSON de cada tree.
-- Tras el window, el cliente nuevo (P16) enviará `group_id`. Para soportar el
-- período intermedio NO aplica (D-01: window simultáneo). El body usa `group_id`
-- per la nueva contract documentada en P16.

-- ============================================================================
-- 10. RLS para parcelas (PARC-02)
-- ============================================================================
ALTER TABLE parcelas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read parcelas"
  ON parcelas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Plantation members can insert parcelas"
  ON parcelas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM plantation_users pu
      WHERE pu.plantation_id = parcelas.plantation_id
      AND pu.user_id = auth.uid()
    )
  );

CREATE POLICY "Plantation members can update parcelas"
  ON parcelas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM plantation_users pu
      WHERE pu.plantation_id = parcelas.plantation_id
      AND pu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM plantation_users pu
      WHERE pu.plantation_id = parcelas.plantation_id
      AND pu.user_id = auth.uid()
    )
  );

CREATE POLICY "Plantation members can delete parcelas"
  ON parcelas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM plantation_users pu
      WHERE pu.plantation_id = parcelas.plantation_id
      AND pu.user_id = auth.uid()
    )
  );

COMMIT;
