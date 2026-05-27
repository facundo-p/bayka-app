-- Drizzle migration 0013: recrear unique indexes en parcelas como PARTIAL
-- (WHERE deleted_at IS NULL).
--
-- D-16-19: con soft-delete (tombstone), un nombre/codigo de una parcela
-- borrada debe poder reusarse. Los unique indexes regulares lo bloqueaban.
-- Partial indexes permiten dos filas con mismo (plantacion_id, codigo) si
-- al menos una está tombstoneada.
--
-- SQLite soporta partial unique indexes desde 3.8.0 (Expo SQLite ≥ 14.x).

DROP INDEX IF EXISTS `parcelas_plantation_code_unique`;
--> statement-breakpoint
DROP INDEX IF EXISTS `parcelas_plantation_name_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `parcelas_plantation_code_unique`
  ON `parcelas` (`plantacion_id`, `codigo`)
  WHERE `deleted_at` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `parcelas_plantation_name_unique`
  ON `parcelas` (`plantacion_id`, `nombre`)
  WHERE `deleted_at` IS NULL;
