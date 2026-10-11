-- Sin uso desde #822: el ID Global sale de la app y el ID Parcial se calcula al
-- exportar. Sin índice, vista, trigger ni FK: DROP COLUMN alcanza.
ALTER TABLE `trees` DROP COLUMN `plantacion_id`;--> statement-breakpoint
ALTER TABLE `trees` DROP COLUMN `global_id`;
