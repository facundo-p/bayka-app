-- Migration 014: Data consolidation — 21 source plantations → 3 + 21 parcelas
-- Per Phase 15 (v1.1) — applied during coordinated window, AFTER 013_cleanup.
-- Atomic via BEGIN..COMMIT.
--
-- Acciones:
--   1. Crear 3 plantations nuevas (SSS, Pruebas-SSS, Pruebas-La Morita).
--   2. Crear 21 parcelas con codes (LP1..LP13, MP1..MP4, SO, P3V, LM, Z1).
--   3. Reasignar groups: UPDATE plantation_id + parcela_id desde sources.
--   4. Recomputar trees.sub_id con formato ParcelaCode+GroupCode+SpeciesCode+Position.
--   5. Normalizar estado 'sincronizada' → 'finalizada'.
--   6. Replicar plantation_users + plantation_species de sources a nuevas.
--   7. DROP+RECREATE groups_estado_check sin 'sincronizada' (Pitfall 7).
--   8. CREATE OR REPLACE sync_subgroup RPC con 'finalizada' (mantiene COALESCE shim).
--
-- NO incluido (separado):
--   - UPDATE trees.foto_url al path nuevo → scripts/migrate-photo-paths.mjs
--   - DELETE de las 21 source plantations → 015_delete_source_plantations.sql
--   - Borrado de archivos físicos en Storage → scripts/cleanup-orphan-photos.mjs
--
-- Post-checks atómicos: 3 nuevas plants, 21 parcelas, 243 groups en nuevas,
-- 7579 trees en nuevas, 0 NULL sub_ids, 0 groups quedan en sources,
-- 0 estado='sincronizada'.

BEGIN;

DO $$
DECLARE
  v_sss_id uuid := gen_random_uuid();
  v_pss_id uuid := gen_random_uuid();
  v_pms_id uuid := gen_random_uuid();
  v_org_id uuid;
  v_admin_id uuid;
BEGIN
  -- ──────────────────────────────────────────────────────────────────────────
  -- Lookup org_id + admin user desde una source plantation conocida.
  -- ──────────────────────────────────────────────────────────────────────────
  SELECT organizacion_id, creado_por INTO v_org_id, v_admin_id
  FROM plantations
  WHERE id = 'cf13f308-c487-462f-8701-d21dd695c5e3'::uuid;  -- SSS-Loma-P1

  IF v_org_id IS NULL OR v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Source plantation cf13f308 not found — cannot derive org/admin';
  END IF;

  -- ──────────────────────────────────────────────────────────────────────────
  -- 1. INSERT 3 plantations nuevas.
  -- ──────────────────────────────────────────────────────────────────────────
  INSERT INTO plantations (id, organizacion_id, lugar, periodo, estado, creado_por, created_at) VALUES
    (v_sss_id, v_org_id, 'San Sebastián de la Selva', 'Otoño 2026',    'activa', v_admin_id, now()),
    (v_pss_id, v_org_id, 'Pruebas - SSS',             'Otoño 2026',    'activa', v_admin_id, now()),
    (v_pms_id, v_org_id, 'Pruebas - La Morita',       'Primavera 2026','activa', v_admin_id, now());

  -- ──────────────────────────────────────────────────────────────────────────
  -- 2. Build temp mapping (21 rows: source_id → target_plantation_id + parcela).
  --    parcela_id auto-generado en la temp table; se referencia en pasos
  --    posteriores para INSERTs de parcelas + UPDATE de groups.
  -- ──────────────────────────────────────────────────────────────────────────
  CREATE TEMP TABLE _mapping (
    source_id            uuid PRIMARY KEY,
    target_plantation_id uuid NOT NULL,
    parcela_id           uuid NOT NULL DEFAULT gen_random_uuid(),
    parcela_nombre       text NOT NULL,
    parcela_codigo       text NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _mapping (source_id, target_plantation_id, parcela_nombre, parcela_codigo) VALUES
    -- Cluster A → San Sebastián de la Selva (17 parcelas)
    ('cf13f308-c487-462f-8701-d21dd695c5e3'::uuid, v_sss_id, 'Loma-P1',  'LP1'),
    ('b9226ac3-e89a-4269-9909-56a4e6897393'::uuid, v_sss_id, 'Loma-P2',  'LP2'),
    ('78a1e694-e7b5-41dc-b4ed-aa77a0576d45'::uuid, v_sss_id, 'Loma-P3',  'LP3'),
    ('3f545ecf-b0ef-419c-a0d8-211df6a1fa63'::uuid, v_sss_id, 'Loma-P4',  'LP4'),
    ('f48aa3c9-d8ee-4f2d-a69e-9abcd63081da'::uuid, v_sss_id, 'Loma-P5',  'LP5'),
    ('eeafcc6e-d2ac-4775-a814-37aa32b3f0d5'::uuid, v_sss_id, 'Loma-P6',  'LP6'),
    ('ac0f42e8-18d0-4618-bc35-fbbfbec9c2db'::uuid, v_sss_id, 'Loma-P7',  'LP7'),
    ('a51cca4c-ac04-44f3-ab51-7f3f21e68403'::uuid, v_sss_id, 'Loma-P8',  'LP8'),
    ('2fdac79f-7e51-4670-b0dd-dc06c80d6cf4'::uuid, v_sss_id, 'Loma-P9',  'LP9'),
    ('29fd1fde-b441-45c1-a6c7-be37a44ac939'::uuid, v_sss_id, 'Loma-P10', 'LP10'),
    ('b8469a0b-dc07-4de7-87c6-0dfb94661117'::uuid, v_sss_id, 'Loma-P11', 'LP11'),
    ('abf7b739-5126-47ae-9973-eafc825c59f9'::uuid, v_sss_id, 'Loma-P12', 'LP12'),
    ('77b3410c-4ae8-4023-b6c6-089de586707f'::uuid, v_sss_id, 'Loma-P13', 'LP13'),
    ('3c542157-5a11-4a0a-aac9-369e93ba91ba'::uuid, v_sss_id, 'Medio-P1', 'MP1'),
    ('9343c880-f026-4252-ae82-6128962afab8'::uuid, v_sss_id, 'Medio-P2', 'MP2'),
    ('93495d6a-20eb-4e7a-88df-e7afa0a3a2b2'::uuid, v_sss_id, 'Medio-P3', 'MP3'),
    ('a0c1119f-6a11-47b5-8b56-9ece1716464d'::uuid, v_sss_id, 'Medio-P4', 'MP4'),  -- post-012c rename (ex-Pp)
    -- Cluster B → Pruebas - SSS (2 parcelas)
    ('67bfd338-f5be-46e9-8b7b-f440a2633873'::uuid, v_pss_id, 'Selva Original', 'SO'),
    ('be0eb2d5-f3ce-465d-8cc1-56651ef03b9a'::uuid, v_pss_id, 'P3 Vieja',       'P3V'),
    -- Cluster C → Pruebas - La Morita (2 parcelas)
    ('5c064556-5a96-4657-b724-15e346ed1228'::uuid, v_pms_id, 'La Morita', 'LM'),
    ('7ab85e48-f482-4fc1-9e07-586ec26751d9'::uuid, v_pms_id, 'Zona 1',    'Z1');

  -- Sanity: 21 mapping rows + las 21 sources existen.
  IF (SELECT COUNT(*) FROM _mapping) <> 21 THEN
    RAISE EXCEPTION 'Expected 21 mapping rows, got %', (SELECT COUNT(*) FROM _mapping);
  END IF;
  IF (SELECT COUNT(*) FROM plantations WHERE id IN (SELECT source_id FROM _mapping)) <> 21 THEN
    RAISE EXCEPTION 'Not all 21 source plantations exist';
  END IF;

  -- ──────────────────────────────────────────────────────────────────────────
  -- 3. INSERT 21 parcelas.
  -- ──────────────────────────────────────────────────────────────────────────
  INSERT INTO parcelas (id, plantation_id, nombre, codigo, descripcion, pending_sync, created_at, updated_at)
  SELECT parcela_id, target_plantation_id, parcela_nombre, parcela_codigo, NULL, false, now(), now()
  FROM _mapping;

  -- ──────────────────────────────────────────────────────────────────────────
  -- 4. Reasignar groups: UPDATE plantation_id + parcela_id desde sources.
  -- ──────────────────────────────────────────────────────────────────────────
  UPDATE groups g
  SET plantation_id = m.target_plantation_id,
      parcela_id   = m.parcela_id
  FROM _mapping m
  WHERE g.plantation_id = m.source_id;

  -- ──────────────────────────────────────────────────────────────────────────
  -- 5. Recomputar trees.sub_id con formato nuevo
  --    sub_id = UPPER(parcela.codigo) || UPPER(group.codigo) || UPPER(species.codigo or 'NN') || posicion
  --
  --    NOTA Postgres: UPDATE...FROM no permite que un LEFT JOIN dentro de FROM
  --    referencie la tabla target (trees t). Por eso species se resuelve via
  --    correlated subquery, no JOIN.
  -- ──────────────────────────────────────────────────────────────────────────
  UPDATE trees t
  SET sub_id = UPPER(p.codigo)
               || UPPER(g.codigo)
               || UPPER(COALESCE((SELECT s.codigo FROM species s WHERE s.id = t.species_id), 'NN'))
               || t.posicion::text
  FROM groups g
  JOIN parcelas p ON p.id = g.parcela_id
  WHERE g.id = t.group_id
    AND g.plantation_id IN (v_sss_id, v_pss_id, v_pms_id);

  -- ──────────────────────────────────────────────────────────────────────────
  -- 6. Normalizar estado: 'sincronizada' → 'finalizada' (MIGR-08).
  -- ──────────────────────────────────────────────────────────────────────────
  UPDATE groups SET estado = 'finalizada' WHERE estado = 'sincronizada';

  -- ──────────────────────────────────────────────────────────────────────────
  -- 7. Replicar plantation_users (union de techs de cada source en su target).
  -- ──────────────────────────────────────────────────────────────────────────
  INSERT INTO plantation_users (plantation_id, user_id, rol_en_plantacion, assigned_at)
  SELECT DISTINCT m.target_plantation_id, pu.user_id, pu.rol_en_plantacion, now()
  FROM _mapping m
  JOIN plantation_users pu ON pu.plantation_id = m.source_id
  ON CONFLICT (plantation_id, user_id) DO NOTHING;

  -- ──────────────────────────────────────────────────────────────────────────
  -- 8. Replicar plantation_species (union de catálogos por cluster).
  -- ──────────────────────────────────────────────────────────────────────────
  INSERT INTO plantation_species (plantation_id, species_id, orden_visual)
  SELECT DISTINCT ON (m.target_plantation_id, ps.species_id)
    m.target_plantation_id, ps.species_id, ps.orden_visual
  FROM _mapping m
  JOIN plantation_species ps ON ps.plantation_id = m.source_id
  ON CONFLICT (plantation_id, species_id) DO NOTHING;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 9. Drop+recreate estado CHECK sin 'sincronizada' (Pitfall 7 — solo después
--    del UPDATE de normalización).
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_estado_check;
ALTER TABLE groups ADD CONSTRAINT groups_estado_check CHECK (estado IN ('activa', 'finalizada'));

-- ────────────────────────────────────────────────────────────────────────────
-- 10. CREATE OR REPLACE sync_subgroup con 'finalizada' (mantiene COALESCE
--     del compat shim 012b para soportar cliente viejo durante Phase 16).
-- ────────────────────────────────────────────────────────────────────────────
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

  INSERT INTO trees (id, group_id, species_id, posicion, sub_id, foto_url, usuario_registro, created_at)
  SELECT
    (t->>'id')::UUID,
    COALESCE((t->>'group_id')::UUID, (t->>'subgroup_id')::UUID),
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

-- ────────────────────────────────────────────────────────────────────────────
-- 11. Post-checks atómicos.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_new_plant_count   int;
  v_parcelas_count    int;
  v_groups_in_new     int;
  v_trees_in_new      int;
  v_null_subid        int;
  v_groups_in_sources int;
BEGIN
  SELECT COUNT(*) INTO v_new_plant_count
  FROM plantations
  WHERE lugar IN ('San Sebastián de la Selva', 'Pruebas - SSS', 'Pruebas - La Morita');
  IF v_new_plant_count <> 3 THEN
    RAISE EXCEPTION 'Post-check: expected 3 new plantations, found %', v_new_plant_count;
  END IF;

  SELECT COUNT(*) INTO v_parcelas_count FROM parcelas;
  IF v_parcelas_count <> 21 THEN
    RAISE EXCEPTION 'Post-check: expected 21 parcelas, found %', v_parcelas_count;
  END IF;

  SELECT COUNT(*) INTO v_groups_in_new
  FROM groups g
  JOIN plantations p ON p.id = g.plantation_id
  WHERE p.lugar IN ('San Sebastián de la Selva', 'Pruebas - SSS', 'Pruebas - La Morita');
  IF v_groups_in_new <> 243 THEN
    RAISE EXCEPTION 'Post-check: expected 243 groups in new plantations, found %', v_groups_in_new;
  END IF;

  SELECT COUNT(*) INTO v_trees_in_new
  FROM trees t
  JOIN groups g ON g.id = t.group_id
  JOIN plantations p ON p.id = g.plantation_id
  WHERE p.lugar IN ('San Sebastián de la Selva', 'Pruebas - SSS', 'Pruebas - La Morita');
  IF v_trees_in_new <> 7579 THEN
    RAISE EXCEPTION 'Post-check: expected 7579 trees in new plantations, found %', v_trees_in_new;
  END IF;

  SELECT COUNT(*) INTO v_null_subid
  FROM trees t
  JOIN groups g ON g.id = t.group_id
  JOIN plantations p ON p.id = g.plantation_id
  WHERE p.lugar IN ('San Sebastián de la Selva', 'Pruebas - SSS', 'Pruebas - La Morita')
    AND (t.sub_id IS NULL OR trim(t.sub_id) = '');
  IF v_null_subid <> 0 THEN
    RAISE EXCEPTION 'Post-check: found % NULL/empty sub_ids in new plantations', v_null_subid;
  END IF;

  SELECT COUNT(*) INTO v_groups_in_sources
  FROM groups g
  WHERE g.plantation_id IN (
    'cf13f308-c487-462f-8701-d21dd695c5e3'::uuid,
    'b9226ac3-e89a-4269-9909-56a4e6897393'::uuid,
    '78a1e694-e7b5-41dc-b4ed-aa77a0576d45'::uuid,
    '3f545ecf-b0ef-419c-a0d8-211df6a1fa63'::uuid,
    'f48aa3c9-d8ee-4f2d-a69e-9abcd63081da'::uuid,
    'eeafcc6e-d2ac-4775-a814-37aa32b3f0d5'::uuid,
    'ac0f42e8-18d0-4618-bc35-fbbfbec9c2db'::uuid,
    'a51cca4c-ac04-44f3-ab51-7f3f21e68403'::uuid,
    '2fdac79f-7e51-4670-b0dd-dc06c80d6cf4'::uuid,
    '29fd1fde-b441-45c1-a6c7-be37a44ac939'::uuid,
    'b8469a0b-dc07-4de7-87c6-0dfb94661117'::uuid,
    'abf7b739-5126-47ae-9973-eafc825c59f9'::uuid,
    '77b3410c-4ae8-4023-b6c6-089de586707f'::uuid,
    '3c542157-5a11-4a0a-aac9-369e93ba91ba'::uuid,
    '9343c880-f026-4252-ae82-6128962afab8'::uuid,
    '93495d6a-20eb-4e7a-88df-e7afa0a3a2b2'::uuid,
    'a0c1119f-6a11-47b5-8b56-9ece1716464d'::uuid,
    '67bfd338-f5be-46e9-8b7b-f440a2633873'::uuid,
    'be0eb2d5-f3ce-465d-8cc1-56651ef03b9a'::uuid,
    '5c064556-5a96-4657-b724-15e346ed1228'::uuid,
    '7ab85e48-f482-4fc1-9e07-586ec26751d9'::uuid
  );
  IF v_groups_in_sources <> 0 THEN
    RAISE EXCEPTION 'Post-check: % groups still attached to source plantations', v_groups_in_sources;
  END IF;

  IF EXISTS (SELECT 1 FROM groups WHERE estado = 'sincronizada') THEN
    RAISE EXCEPTION 'Post-check: groups con estado=sincronizada todavía existen';
  END IF;
END $$;

COMMIT;
