-- SQLite no indexa las foreign keys automáticamente (#449). El pull y la app
-- filtran por estas columnas y hasta acá era scan de tabla completa.
--
-- `groups.parcela_id` NO lleva índice: es la columna izquierda de
-- `groups_parcela_code_unique`, y SQLite ya resuelve `WHERE parcela_id = ?` con
-- ese índice. En `parcelas` el equivalente es PARCIAL (`WHERE deleted_at IS
-- NULL`), así que solo sirve cuando la query también filtra por eso — de ahí el
-- índice propio.
CREATE INDEX IF NOT EXISTS `trees_group_id_idx` ON `trees` (`group_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `groups_plantacion_id_idx` ON `groups` (`plantacion_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `parcelas_plantacion_id_idx` ON `parcelas` (`plantacion_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `plantation_species_plantacion_id_idx` ON `plantation_species` (`plantacion_id`);
