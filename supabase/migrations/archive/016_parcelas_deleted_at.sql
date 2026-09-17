-- Migration 016: Add deleted_at tombstone column to parcelas (server-side).
-- D-16-19, D-16-21. Counterpart to mobile Drizzle 0012.
--
-- Habilita soft-delete cross-device: el cliente push sube tombstones; el pull
-- baja tombstones del server. La fila persiste (no se borra físicamente) y
-- queries de lectura filtran `WHERE deleted_at IS NULL` por default.
--
-- Sin index sobre deleted_at: cardinalidad baja en v1.1; si emerge necesidad
-- en v1.2+, agregar `CREATE INDEX parcelas_deleted_at_idx ON parcelas(deleted_at)
-- WHERE deleted_at IS NOT NULL` en una migration posterior.
--
-- RLS existente se preserva: la columna nueva no afecta policies; SELECT *
-- sigue funcionando para usuarios autorizados.
--
-- Idempotente vía IF NOT EXISTS.

BEGIN;

ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN parcelas.deleted_at IS
  'Tombstone para soft-delete (D-16-19). NULL = parcela activa. NOT NULL = parcela borrada (no resucitar).';

COMMIT;
