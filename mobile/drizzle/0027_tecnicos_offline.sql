-- Técnicos asignables sin conexión (#636): caché de los técnicos activos de la
-- organización y las asignaciones hechas en el teléfono que todavía no subieron.
CREATE TABLE IF NOT EXISTS `tecnicos_de_organizacion` (
	`id` text PRIMARY KEY NOT NULL,
	`organizacion_id` text NOT NULL,
	`nombre` text NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `altas_de_tecnicos_pendientes` (
	`plantacion_id` text NOT NULL,
	`user_id` text NOT NULL,
	`nombre` text DEFAULT '' NOT NULL,
	`asignado_en` text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `altas_de_tecnicos_pendientes_pk` ON `altas_de_tecnicos_pendientes` (`plantacion_id`,`user_id`);
