-- Especie que el servidor tenía la última vez que este dispositivo vio el árbol
-- (#679). El push la manda como base: el server no pisa un cambio de especie más
-- nuevo que el dispositivo no vio. En un grupo ya subido es la especie local. En
-- uno con cambios sin subir no se sabe (hasta esta versión la especie solo
-- cambiaba al resolver un N/N) y queda N/N: si el server tiene otra especie, gana
-- la del server y la sync lo avisa.
ALTER TABLE `trees` ADD `especie_base_id` text;--> statement-breakpoint
UPDATE `trees` SET `especie_base_id` = `especie_id`
 WHERE `group_id` NOT IN (SELECT `id` FROM `groups` WHERE `pending_sync` = 1);--> statement-breakpoint
-- Sin marca de conflicto por árbol: si los dos lados cambiaron la especie, gana
-- la del server. Las columnas no tienen índice ni FK: DROP COLUMN alcanza.
ALTER TABLE `trees` DROP COLUMN `conflict_especie_id`;--> statement-breakpoint
ALTER TABLE `trees` DROP COLUMN `conflict_especie_nombre`;
