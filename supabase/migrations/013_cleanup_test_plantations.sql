-- Migration 013: Cleanup test plantations (MIGR-07)
-- Per Phase 15 (v1.1) — applied during coordinated window, AFTER 012, BEFORE 014.
-- Deletes the 11 test/garbage plantations enumerated in REQUIREMENTS.md MIGR-07.
-- CASCADE FK deletes asociated groups + trees (44 grupos + 433 árboles per MIGR-07).
-- Atomic via BEGIN..COMMIT.
--
-- NOTE: photo files in Storage (bucket tree-photos) under
-- `plantations/<one-of-these-11-ids>/trees/*.jpg` quedan huérfanas.
-- Se limpian con scripts/cleanup-orphan-photos.mjs DESPUÉS de 014.

BEGIN;

-- Sanity check: confirmar que las 11 filas existen antes de borrar.
-- Si alguna no existe, la transacción aborta (count <> 11).
DO $$
DECLARE
  found_count int;
BEGIN
  SELECT COUNT(*) INTO found_count
  FROM plantations
  WHERE id IN (
    '00000000-0000-0000-0000-000000000002'::uuid,
    'e072775e-074b-457a-9739-e04838978316'::uuid,
    '80b85acd-e58b-44cf-9169-a3f25741e114'::uuid,
    '26e190db-d453-42b4-96bf-16a1969fc1ae'::uuid,
    '747981d3-78d3-46db-9414-ae6ad8a83f62'::uuid,
    '0eea0006-b98f-4ae8-a55e-eb58ceb4824b'::uuid,
    'a536bd66-1d7b-41be-9b96-2303cfdc0514'::uuid,
    '09a315e2-0754-410b-81da-d3ff862cd8bb'::uuid,
    '203beee5-981f-4029-9cc5-9403d14ae0a5'::uuid,
    '6d2e80b0-7ede-4d24-a50a-210060c4465a'::uuid,
    '7fea8850-ec03-4be9-86dc-0a4efc5ae7f0'::uuid
  );

  IF found_count <> 11 THEN
    RAISE EXCEPTION 'MIGR-07 pre-check failed: expected 11 plantations, found %', found_count;
  END IF;
END $$;

-- DELETE cascade: borrar las 11 plantations. FKs ON DELETE CASCADE en
-- groups, trees, plantation_users, plantation_species (per 006_add_cascade_deletes.sql)
-- propagan el delete a todas las filas hijas.
DELETE FROM plantations
WHERE id IN (
  '00000000-0000-0000-0000-000000000002'::uuid,  -- La Maluka - Zona Alta Lote 1
  'e072775e-074b-457a-9739-e04838978316'::uuid,  -- SSS-LOMA-P1 (vacío)
  '80b85acd-e58b-44cf-9169-a3f25741e114'::uuid,  -- Plantación Abril
  '26e190db-d453-42b4-96bf-16a1969fc1ae'::uuid,  -- Hfhj
  '747981d3-78d3-46db-9414-ae6ad8a83f62'::uuid,  -- Plantacion test 1
  '0eea0006-b98f-4ae8-a55e-eb58ceb4824b'::uuid,  -- Aa
  'a536bd66-1d7b-41be-9b96-2303cfdc0514'::uuid,  -- Plant 2
  '09a315e2-0754-410b-81da-d3ff862cd8bb'::uuid,  -- Plant 3
  '203beee5-981f-4029-9cc5-9403d14ae0a5'::uuid,  -- Plant 4
  '6d2e80b0-7ede-4d24-a50a-210060c4465a'::uuid,  -- Plantación test 2
  '7fea8850-ec03-4be9-86dc-0a4efc5ae7f0'::uuid   -- Plant Test 4
);

-- Post-check: confirmar que las 11 fueron borradas + que quedan 21 plantations.
DO $$
DECLARE
  remaining_target int;
  total_remaining int;
BEGIN
  SELECT COUNT(*) INTO remaining_target
  FROM plantations
  WHERE id IN (
    '00000000-0000-0000-0000-000000000002'::uuid,
    'e072775e-074b-457a-9739-e04838978316'::uuid,
    '80b85acd-e58b-44cf-9169-a3f25741e114'::uuid,
    '26e190db-d453-42b4-96bf-16a1969fc1ae'::uuid,
    '747981d3-78d3-46db-9414-ae6ad8a83f62'::uuid,
    '0eea0006-b98f-4ae8-a55e-eb58ceb4824b'::uuid,
    'a536bd66-1d7b-41be-9b96-2303cfdc0514'::uuid,
    '09a315e2-0754-410b-81da-d3ff862cd8bb'::uuid,
    '203beee5-981f-4029-9cc5-9403d14ae0a5'::uuid,
    '6d2e80b0-7ede-4d24-a50a-210060c4465a'::uuid,
    '7fea8850-ec03-4be9-86dc-0a4efc5ae7f0'::uuid
  );

  IF remaining_target <> 0 THEN
    RAISE EXCEPTION 'MIGR-07 post-check failed: target plantations still exist (%)', remaining_target;
  END IF;

  SELECT COUNT(*) INTO total_remaining FROM plantations;
  IF total_remaining <> 21 THEN
    RAISE EXCEPTION 'MIGR-07 post-check failed: expected 21 plantations remaining, found %', total_remaining;
  END IF;
END $$;

COMMIT;
