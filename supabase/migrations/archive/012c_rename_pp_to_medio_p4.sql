-- Migration 012c: Rename "Pp" → "SSS-Medio-P4"; old "SSS-Medio-P4" → "...-deprecated"
-- Aplicado tras 012 + 012b en el window de Phase 15 (2026-05-22).
--
-- Contexto: un técnico sincronizó (vía 012b compat shim) una plantación llamada
-- "Pp" (UUID a0c1119f-6a11-47b5-8b56-9ece1716464d, 20 grupos / 920 árboles) que
-- ES la verdadera SSS-Medio-P4. La existente "SSS-Medio-P4" en server
-- (UUID 51fea9e5-2537-4cef-82fd-c07d6375dbf0, 2 grupos / 117 árboles) tiene
-- data incorrecta/test.
--
-- Acciones:
--   1. Rename vieja SSS-Medio-P4 → "SSS-Medio-P4-deprecated" (queda viva
--      por decisión del usuario; cleanup deferred via scripts/deferred/).
--   2. Rename Pp → "SSS-Medio-P4" con periodo='Otoño 2026' (matching cluster).
--
-- Esto deja a la nueva SSS-Medio-P4 elegible para el mapping cluster A → MP4
-- en 014_data_consolidation.sql sin tocar el plan original.
--
-- No hay UNIQUE constraint en plantations.lugar — orden de renames no crítico,
-- pero hacemos primero el deprecated por claridad.

BEGIN;

-- Sanity pre-check: ambas filas deben existir con los nombres esperados.
DO $$
DECLARE
  old_match int;
  pp_match  int;
BEGIN
  SELECT COUNT(*) INTO old_match FROM plantations
    WHERE id = '51fea9e5-2537-4cef-82fd-c07d6375dbf0'::uuid AND lugar = 'SSS-Medio-P4';
  SELECT COUNT(*) INTO pp_match FROM plantations
    WHERE id = 'a0c1119f-6a11-47b5-8b56-9ece1716464d'::uuid AND lugar = 'Pp';

  IF old_match <> 1 THEN
    RAISE EXCEPTION 'Pre-check failed: old SSS-Medio-P4 (51fea9e5...) not found or already renamed';
  END IF;
  IF pp_match <> 1 THEN
    RAISE EXCEPTION 'Pre-check failed: Pp (a0c1119f...) not found or already renamed';
  END IF;
END $$;

-- 1. Rename vieja SSS-Medio-P4 a deprecated (preserva periodo original)
UPDATE plantations
SET lugar = 'SSS-Medio-P4-deprecated'
WHERE id = '51fea9e5-2537-4cef-82fd-c07d6375dbf0'::uuid;

-- 2. Rename Pp a SSS-Medio-P4 con periodo del cluster
UPDATE plantations
SET lugar = 'SSS-Medio-P4',
    periodo = 'Otoño 2026'
WHERE id = 'a0c1119f-6a11-47b5-8b56-9ece1716464d'::uuid;

-- Post-check: queda exactamente UNA plantación llamada SSS-Medio-P4
-- y exactamente UNA con sufijo -deprecated
DO $$
DECLARE
  current_count int;
  deprecated_count int;
BEGIN
  SELECT COUNT(*) INTO current_count FROM plantations WHERE lugar = 'SSS-Medio-P4';
  SELECT COUNT(*) INTO deprecated_count FROM plantations WHERE lugar = 'SSS-Medio-P4-deprecated';

  IF current_count <> 1 THEN
    RAISE EXCEPTION 'Post-check failed: expected 1 SSS-Medio-P4, found %', current_count;
  END IF;
  IF deprecated_count <> 1 THEN
    RAISE EXCEPTION 'Post-check failed: expected 1 SSS-Medio-P4-deprecated, found %', deprecated_count;
  END IF;
END $$;

COMMIT;
