-- Sin uso desde #679. Sin índice, vista, trigger ni FK: DROP COLUMN alcanza.
ALTER TABLE `trees` DROP COLUMN `conflict_especie_id`;--> statement-breakpoint
ALTER TABLE `trees` DROP COLUMN `conflict_especie_nombre`;
