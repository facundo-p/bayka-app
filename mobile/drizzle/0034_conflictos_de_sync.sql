-- Bases de foto, GPS y datos del grupo, y conflictos de sincronización (#795).
--
-- En un grupo ya subido la base es el valor local, que el pull dejó igual al del
-- servidor; la foto, solo si sigue siendo el path de Storage (una bajada no
-- guarda el path y el pull la completa). En un grupo con cambios sin subir no se
-- sabe: el punto queda sin base y, si el servidor tiene otro, la sync lo trae
-- como conflicto en vez de perderlo. El grupo queda sin base y sube como antes.
ALTER TABLE `trees` ADD `foto_base` text;--> statement-breakpoint
ALTER TABLE `trees` ADD `latitude_base` real;--> statement-breakpoint
ALTER TABLE `trees` ADD `longitude_base` real;--> statement-breakpoint
ALTER TABLE `trees` ADD `gps_captured_at_base` text;--> statement-breakpoint
UPDATE `trees`
   SET `latitude_base` = `latitude`,
       `longitude_base` = `longitude`,
       `gps_captured_at_base` = `gps_captured_at`,
       `foto_base` = CASE WHEN `foto_url` LIKE 'file://%' OR `foto_url` LIKE 'content://%' THEN NULL ELSE `foto_url` END
 WHERE `group_id` NOT IN (SELECT `id` FROM `groups` WHERE `pending_sync` = 1);--> statement-breakpoint
ALTER TABLE `groups` ADD `base_del_servidor` text;--> statement-breakpoint
UPDATE `groups`
   SET `base_del_servidor` = json_object('nombre', `nombre`, 'codigo', `codigo`, 'tipo', `tipo`, 'estado', `estado`)
 WHERE `pending_sync` = 0;--> statement-breakpoint
CREATE TABLE `conflictos_de_sync` (
	`entidad_id` text NOT NULL,
	`campo` text NOT NULL,
	`grupo_id` text NOT NULL,
	`plantacion_id` text NOT NULL,
	`mio` text,
	`servidor` text,
	`detectado_en` text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `conflictos_de_sync_pk` ON `conflictos_de_sync` (`entidad_id`,`campo`);--> statement-breakpoint
CREATE INDEX `conflictos_de_sync_grupo_idx` ON `conflictos_de_sync` (`grupo_id`);
