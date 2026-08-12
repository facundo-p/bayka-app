-- #90: parcela obligatoria en groups — todo grupo pertenece a una parcela; la
-- ausencia es un dato inválido, no un caso válido (los datos legacy pre-P15 ya
-- se migraron en server y se propagaron a los devices vía pull).
-- SQLite no soporta ALTER COLUMN: recreate de la tabla (patrón de la mig 0011).
-- Si un device retuviera una fila con parcela_id NULL (no debería: requiere no
-- haber sincronizado desde la migración de datos legacy), el INSERT falla y la
-- migración se detiene — preferible a degradar el invariante en silencio.
CREATE TABLE `groups_new` (
	`id` text PRIMARY KEY NOT NULL,
	`plantacion_id` text NOT NULL,
	`parcela_id` text NOT NULL,
	`nombre` text NOT NULL,
	`codigo` text NOT NULL,
	`tipo` text DEFAULT 'linea' NOT NULL,
	`estado` text DEFAULT 'activa' NOT NULL,
	`usuario_creador` text NOT NULL,
	`created_at` text NOT NULL,
	`pending_sync` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`plantacion_id`) REFERENCES `plantations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parcela_id`) REFERENCES `parcelas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `groups_new` (`id`, `plantacion_id`, `parcela_id`, `nombre`, `codigo`, `tipo`, `estado`, `usuario_creador`, `created_at`, `pending_sync`)
  SELECT `id`, `plantacion_id`, `parcela_id`, `nombre`, `codigo`, `tipo`, `estado`, `usuario_creador`, `created_at`, `pending_sync` FROM `groups`;
--> statement-breakpoint
DROP TABLE `groups`;
--> statement-breakpoint
ALTER TABLE `groups_new` RENAME TO `groups`;
--> statement-breakpoint
CREATE UNIQUE INDEX `groups_parcela_code_unique` ON `groups` (`parcela_id`,`codigo`);
--> statement-breakpoint
CREATE UNIQUE INDEX `groups_parcela_name_unique` ON `groups` (`parcela_id`,`nombre`);
