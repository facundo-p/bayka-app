-- Altas y bajas de especies de una plantación que todavía no llegaron al server (#635).
-- Una fila por par plantación-especie: el último cambio gana, y subir es idempotente.
CREATE TABLE IF NOT EXISTS `cambios_especies_pendientes` (
	`plantacion_id` text NOT NULL,
	`especie_id` text NOT NULL,
	`tipo` text NOT NULL,
	`cambiado_en` text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `cambios_especies_pendientes_pk` ON `cambios_especies_pendientes` (`plantacion_id`,`especie_id`);
