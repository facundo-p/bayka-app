-- DEFERRED — NO EJECUTAR como parte de la cadena de migrations.
-- Borra la plantación "SSS-Medio-P4-deprecated" (UUID 51fea9e5-...) y todas sus
-- entidades hijas via CASCADE FK (groups, trees, plantation_users, plantation_species).
--
-- IMPORTANTE: correr primero `delete-deprecated-medio-p4-photos.mjs` para limpiar
-- los archivos físicos del bucket Storage. Este SQL solo borra filas de Postgres.
--
-- Pegar en Supabase SQL Editor cuando se decida limpiar.

BEGIN;

-- Pre-check: confirmar que la fila existe con el nombre esperado.
DO $$
DECLARE
  match int;
BEGIN
  SELECT COUNT(*) INTO match FROM plantations
    WHERE id = '51fea9e5-2537-4cef-82fd-c07d6375dbf0'::uuid
      AND lugar = 'SSS-Medio-P4-deprecated';
  IF match <> 1 THEN
    RAISE EXCEPTION 'Pre-check failed: SSS-Medio-P4-deprecated (51fea9e5...) not found. Verificar nombre/UUID o si ya fue borrada.';
  END IF;
END $$;

-- CASCADE delete.
DELETE FROM plantations
WHERE id = '51fea9e5-2537-4cef-82fd-c07d6375dbf0'::uuid;

-- Post-check.
DO $$
DECLARE
  remaining int;
BEGIN
  SELECT COUNT(*) INTO remaining FROM plantations
    WHERE id = '51fea9e5-2537-4cef-82fd-c07d6375dbf0'::uuid;
  IF remaining <> 0 THEN
    RAISE EXCEPTION 'Post-check failed: row still exists';
  END IF;
END $$;

COMMIT;
