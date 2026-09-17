-- Migration 013: Cleanup test plantations (MIGR-07 + 5 nuevas detectadas 2026-05-25)
-- Per Phase 15 (v1.1) — applied during coordinated window, AFTER 012/012b/012c, BEFORE 014.
-- Atomic via BEGIN..COMMIT.
--
-- Lista original MIGR-07 (11 plantations):
--   00000000... La Maluka - Zona Alta Lote 1
--   e072775e... SSS-LOMA-P1 (vacío)
--   80b85acd... Plantación Abril
--   26e190db... Hfhj
--   747981d3... Plantacion test 1
--   0eea0006... Aa
--   a536bd66... Plant 2
--   09a315e2... Plant 3
--   203beee5... Plant 4
--   6d2e80b0... Plantación test 2
--   7fea8850... Plant Test 4
--
-- Nuevas detectadas en auditoría 2026-05-25 (creadas tras planning original):
--   0dfa2ced... Ghh
--   58b43096... Achalay
--   461a37c7... Reserva Achalay
--   ad648fab... prueba (ahora ya mismito)
--   5ccc718b... prueba (ahora)
--
-- Total: 16 plantations a borrar. CASCADE FK propaga delete a groups, trees,
-- plantation_users, plantation_species.
--
-- Plantaciones que quedan vivas tras 013:
--   - 17 Cluster A (SSS-Loma-P1..P13 + SSS-Medio-P1..P4 incluyendo el rename
--     Pp→SSS-Medio-P4 de 012c)
--   - 2 Cluster B (SSS - P3, San Sebastián de la Selva)
--   - 2 Cluster C (La Morita Zona 1, Misiones - La Morita)
--   - 1 deprecated (51fea9e5... SSS-Medio-P4-deprecated — deferred cleanup)
--   Total: 22 plantations remaining.

BEGIN;

-- Sanity pre-check: confirmar que las 16 filas existen antes de borrar.
DO $$
DECLARE
  found_count int;
BEGIN
  SELECT COUNT(*) INTO found_count
  FROM plantations
  WHERE id IN (
    -- MIGR-07 original
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
    '7fea8850-ec03-4be9-86dc-0a4efc5ae7f0'::uuid,
    -- Nuevas auditoría 2026-05-25
    '0dfa2ced-ab5a-46bc-8046-2549480d63d4'::uuid,  -- Ghh
    '58b43096-23c4-4820-8398-1b5d8640bb6d'::uuid,  -- Achalay
    '461a37c7-7d4d-47b4-b9d4-6e032fdbb42a'::uuid,  -- Reserva Achalay
    'ad648fab-4fc9-4a94-bbbf-0f9acdbb5d8b'::uuid,  -- prueba (ahora ya mismito)
    '5ccc718b-e049-4b58-b2e6-ffb96df87a8f'::uuid   -- prueba (ahora)
  );

  IF found_count <> 16 THEN
    RAISE EXCEPTION 'Pre-check failed: expected 16 plantations, found %', found_count;
  END IF;
END $$;

-- DELETE cascade.
DELETE FROM plantations
WHERE id IN (
  -- MIGR-07 original (11)
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
  '7fea8850-ec03-4be9-86dc-0a4efc5ae7f0'::uuid,  -- Plant Test 4
  -- Nuevas auditoría 2026-05-25 (5)
  '0dfa2ced-ab5a-46bc-8046-2549480d63d4'::uuid,  -- Ghh
  '58b43096-23c4-4820-8398-1b5d8640bb6d'::uuid,  -- Achalay
  '461a37c7-7d4d-47b4-b9d4-6e032fdbb42a'::uuid,  -- Reserva Achalay
  'ad648fab-4fc9-4a94-bbbf-0f9acdbb5d8b'::uuid,  -- prueba (ahora ya mismito)
  '5ccc718b-e049-4b58-b2e6-ffb96df87a8f'::uuid   -- prueba (ahora)
);

-- Post-check: ninguna de las 16 sobrevive + total final = 22.
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
    '7fea8850-ec03-4be9-86dc-0a4efc5ae7f0'::uuid,
    '0dfa2ced-ab5a-46bc-8046-2549480d63d4'::uuid,
    '58b43096-23c4-4820-8398-1b5d8640bb6d'::uuid,
    '461a37c7-7d4d-47b4-b9d4-6e032fdbb42a'::uuid,
    'ad648fab-4fc9-4a94-bbbf-0f9acdbb5d8b'::uuid,
    '5ccc718b-e049-4b58-b2e6-ffb96df87a8f'::uuid
  );

  IF remaining_target <> 0 THEN
    RAISE EXCEPTION 'Post-check failed: target plantations still exist (%)', remaining_target;
  END IF;

  SELECT COUNT(*) INTO total_remaining FROM plantations;
  IF total_remaining <> 22 THEN
    RAISE EXCEPTION 'Post-check failed: expected 22 plantations remaining (21 productive + 1 deprecated), found %', total_remaining;
  END IF;
END $$;

COMMIT;
