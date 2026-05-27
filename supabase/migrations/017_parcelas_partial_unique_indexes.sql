-- Migration 017: convertir parcelas unique constraints en PARTIAL UNIQUE
-- INDEXES filtrando tombstones (deleted_at IS NULL).
--
-- D-16-19: con soft-delete, debe permitirse reusar nombre/codigo de parcelas
-- tombstoneadas. La unique constraint regular bloquea esto.
--
-- Postgres no permite cambiar una UNIQUE CONSTRAINT a PARTIAL; hay que dropear
-- el constraint y crear un partial unique index con el mismo nombre.
--
-- Idempotente: usa IF EXISTS / IF NOT EXISTS.

BEGIN;

-- 1. Drop existing UNIQUE constraints (creados en 012_parcelas_and_rename.sql)
ALTER TABLE parcelas DROP CONSTRAINT IF EXISTS parcelas_plantation_code_unique;
ALTER TABLE parcelas DROP CONSTRAINT IF EXISTS parcelas_plantation_name_unique;

-- También dropear indexes residuales del mismo nombre por las dudas.
DROP INDEX IF EXISTS parcelas_plantation_code_unique;
DROP INDEX IF EXISTS parcelas_plantation_name_unique;

-- 2. Crear partial unique indexes (filtran tombstones).
CREATE UNIQUE INDEX parcelas_plantation_code_unique
  ON parcelas (plantation_id, codigo)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX parcelas_plantation_name_unique
  ON parcelas (plantation_id, nombre)
  WHERE deleted_at IS NULL;

COMMENT ON INDEX parcelas_plantation_code_unique IS
  'Partial unique: tombstoneadas (deleted_at NOT NULL) excluidas. D-16-19.';
COMMENT ON INDEX parcelas_plantation_name_unique IS
  'Partial unique: tombstoneadas (deleted_at NOT NULL) excluidas. D-16-19.';

COMMIT;
