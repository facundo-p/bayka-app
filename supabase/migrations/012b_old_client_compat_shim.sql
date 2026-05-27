-- Migration 012b: Backward-compat shim for OLD clients (pre-Phase 16)
-- Per Phase 15 incident response (2026-05-20): un técnico tiene ~1000 árboles
-- pendientes de sync en un APK con código viejo que referencia `subgroups` y
-- `trees.subgroup_id`. Migration 012 renombró ambos (a `groups`/`group_id`),
-- dejando al cliente roto.
--
-- Este shim expone los nombres viejos para que el cliente viejo sincronice:
--   1. VIEW `subgroups` que espeja `groups` (SELECTs read-only del cliente)
--   2. Columna generada `trees.subgroup_id` (alias de `group_id` para SELECTs y filtros .in())
--   3. RPC `sync_subgroup` con COALESCE para aceptar ambos campos en el JSON
--
-- Se REMUEVE en Phase 16 después de desplegar el APK con nombres nuevos
-- (migration `016_remove_compat_shim.sql` — TBD).
--
-- Idempotente / reversible. Atomic via BEGIN..COMMIT.

BEGIN;

-- ============================================================================
-- 1. VIEW subgroups → groups (SELECT only)
-- ============================================================================
-- security_invoker = true: el view aplica las RLS policies del usuario que
-- consulta, no del owner del view. Sin esto, expondría filas sin filtrar por
-- RLS (security hole). Requiere Postgres 15+ (Supabase actual).
CREATE OR REPLACE VIEW subgroups
WITH (security_invoker = true) AS
SELECT
  id,
  plantation_id,
  parcela_id,
  nombre,
  codigo,
  tipo,
  estado,
  usuario_creador,
  created_at
FROM groups;

GRANT SELECT ON subgroups TO authenticated;

-- ============================================================================
-- 2. trees.subgroup_id GENERATED column (alias de group_id)
-- ============================================================================
-- Solo se agrega si NO existe (ALTER TABLE ... IF NOT EXISTS).
-- Cliente viejo hace `.from('trees').select('*')` → recibe la columna.
-- Cliente viejo hace `.in('subgroup_id', [...])` → filtra por la columna.
-- INSERTs a trees pasan por la RPC (no INSERT directo del cliente), entonces
-- no hay riesgo de conflicto "cannot insert into generated column".
ALTER TABLE trees ADD COLUMN IF NOT EXISTS subgroup_id uuid
  GENERATED ALWAYS AS (group_id) STORED;

-- ============================================================================
-- 3. RPC sync_subgroup con COALESCE en el JSON de trees
-- ============================================================================
-- El cliente viejo manda `{"subgroup_id": "..."}` por cada tree.
-- El cliente nuevo (Phase 16) mandará `{"group_id": "..."}`.
-- COALESCE soporta ambos durante el período de transición.
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
    COALESCE((t->>'group_id')::UUID, (t->>'subgroup_id')::UUID),  -- shim: acepta ambos
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

COMMIT;
