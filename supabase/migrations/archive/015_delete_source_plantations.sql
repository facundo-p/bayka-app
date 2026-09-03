-- Migration 015: Delete las 21 source plantations vaciadas por 014.
-- Per Phase 15 (v1.1) — applied AFTER migrate-photo-paths.mjs completa.
-- Atomic via BEGIN..COMMIT.
--
-- Tras 014, las 21 source plantations tienen 0 groups (todos reasignados a
-- las 3 nuevas + parcelas). Sus filas plantation_users/plantation_species
-- también fueron replicadas a las nuevas (ON CONFLICT DO NOTHING). DELETE
-- aquí solo borra metadata huérfana.
--
-- CASCADE FK: borrar la fila de plantation borra cualquier
-- plantation_users/plantation_species/groups asociado. Como groups está en 0
-- y users/species ya están replicados, no se pierde nada.
--
-- NO borra la SSS-Medio-P4-deprecated (51fea9e5-...) — esa queda viva
-- por D-15-27, cleanup deferred via scripts/deferred/.

BEGIN;

-- Sanity pre-check: 21 sources existen + tienen 0 groups cada una.
DO $$
DECLARE
  v_sources_count int;
  v_orphan_groups int;
BEGIN
  SELECT COUNT(*) INTO v_sources_count
  FROM plantations
  WHERE id IN (
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
  IF v_sources_count <> 21 THEN
    RAISE EXCEPTION 'Pre-check: expected 21 source plantations, found %', v_sources_count;
  END IF;

  SELECT COUNT(*) INTO v_orphan_groups
  FROM groups
  WHERE plantation_id IN (
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
  IF v_orphan_groups <> 0 THEN
    RAISE EXCEPTION 'Pre-check: source plantations have % groups attached (should be 0)', v_orphan_groups;
  END IF;
END $$;

-- DELETE las 21 sources.
DELETE FROM plantations
WHERE id IN (
  'cf13f308-c487-462f-8701-d21dd695c5e3'::uuid,  -- SSS-Loma-P1
  'b9226ac3-e89a-4269-9909-56a4e6897393'::uuid,  -- SSS-Loma-P2
  '78a1e694-e7b5-41dc-b4ed-aa77a0576d45'::uuid,  -- SSS-Loma-P3
  '3f545ecf-b0ef-419c-a0d8-211df6a1fa63'::uuid,  -- SSS-Loma-P4
  'f48aa3c9-d8ee-4f2d-a69e-9abcd63081da'::uuid,  -- SSS-Loma-P5
  'eeafcc6e-d2ac-4775-a814-37aa32b3f0d5'::uuid,  -- SSS-Loma-P6
  'ac0f42e8-18d0-4618-bc35-fbbfbec9c2db'::uuid,  -- SSS-Loma-P7
  'a51cca4c-ac04-44f3-ab51-7f3f21e68403'::uuid,  -- SSS-Loma-P8
  '2fdac79f-7e51-4670-b0dd-dc06c80d6cf4'::uuid,  -- SSS-Loma-P9
  '29fd1fde-b441-45c1-a6c7-be37a44ac939'::uuid,  -- SSS-Loma-P10
  'b8469a0b-dc07-4de7-87c6-0dfb94661117'::uuid,  -- SSS-Loma-P11
  'abf7b739-5126-47ae-9973-eafc825c59f9'::uuid,  -- SSS-Loma-P12
  '77b3410c-4ae8-4023-b6c6-089de586707f'::uuid,  -- SSS-Loma-P13
  '3c542157-5a11-4a0a-aac9-369e93ba91ba'::uuid,  -- SSS-Medio-P1
  '9343c880-f026-4252-ae82-6128962afab8'::uuid,  -- SSS-Medio-P2
  '93495d6a-20eb-4e7a-88df-e7afa0a3a2b2'::uuid,  -- SSS-Medio-P3
  'a0c1119f-6a11-47b5-8b56-9ece1716464d'::uuid,  -- SSS-Medio-P4 (ex-Pp)
  '67bfd338-f5be-46e9-8b7b-f440a2633873'::uuid,  -- San Sebastián de la Selva (vieja, 77t)
  'be0eb2d5-f3ce-465d-8cc1-56651ef03b9a'::uuid,  -- SSS - P3
  '5c064556-5a96-4657-b724-15e346ed1228'::uuid,  -- Misiones - La Morita
  '7ab85e48-f482-4fc1-9e07-586ec26751d9'::uuid   -- La Morita Zona 1
);

-- Post-check: 0 sources, plantations total = 4 (3 consolidadas + 1 deprecated).
DO $$
DECLARE
  v_remaining_sources int;
  v_total int;
BEGIN
  SELECT COUNT(*) INTO v_remaining_sources
  FROM plantations
  WHERE id IN (
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
  IF v_remaining_sources <> 0 THEN
    RAISE EXCEPTION 'Post-check: % source plantations still exist', v_remaining_sources;
  END IF;

  SELECT COUNT(*) INTO v_total FROM plantations;
  IF v_total <> 4 THEN
    RAISE EXCEPTION 'Post-check: expected 4 plantations (3 consolidated + 1 deprecated), found %', v_total;
  END IF;
END $$;

COMMIT;
