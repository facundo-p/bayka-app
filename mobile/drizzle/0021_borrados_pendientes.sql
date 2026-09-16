-- Registro de borrados a propagar al server (#467). Sin esto el borrado vive solo
-- en SQLite, el pull resucita la fila y la renumeración deja SubIDs duplicados.
--
-- Registro y no columna `deleted_at` en `trees`: un tombstone obliga a filtrar
-- `deleted_at IS NULL` en TODAS las lecturas de árboles, que están por todo el
-- código. Esto no toca ninguna.
CREATE TABLE IF NOT EXISTS `borrados_pendientes` (
	`id` text PRIMARY KEY NOT NULL,
	`tipo` text NOT NULL,
	`grupo_id` text,
	`plantacion_id` text NOT NULL,
	`borrado_en` text NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `borrados_pendientes_plantacion_idx` ON `borrados_pendientes` (`plantacion_id`);
