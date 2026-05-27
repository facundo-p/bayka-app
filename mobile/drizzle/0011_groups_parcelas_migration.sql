CREATE TABLE `parcelas` (
	`id` text PRIMARY KEY NOT NULL,
	`plantacion_id` text NOT NULL,
	`nombre` text NOT NULL,
	`codigo` text NOT NULL,
	`descripcion` text,
	`pending_sync` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`plantacion_id`) REFERENCES `plantations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`plantacion_id` text NOT NULL,
	`parcela_id` text,
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
INSERT INTO `groups` (`id`, `plantacion_id`, `parcela_id`, `nombre`, `codigo`, `tipo`, `estado`, `usuario_creador`, `created_at`, `pending_sync`)
  SELECT `id`, `plantacion_id`, NULL, `nombre`, `codigo`, `tipo`, `estado`, `usuario_creador`, `created_at`, `pending_sync` FROM `subgroups`;
--> statement-breakpoint
CREATE TABLE `trees_new` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`especie_id` text,
	`posicion` integer NOT NULL,
	`sub_id` text NOT NULL,
	`foto_url` text,
	`foto_synced` integer DEFAULT false NOT NULL,
	`plantacion_id` integer,
	`global_id` integer,
	`usuario_registro` text NOT NULL,
	`created_at` text NOT NULL,
	`conflict_especie_id` text,
	`conflict_especie_nombre` text,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`especie_id`) REFERENCES `species`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `trees_new` (`id`, `group_id`, `especie_id`, `posicion`, `sub_id`, `foto_url`, `foto_synced`, `plantacion_id`, `global_id`, `usuario_registro`, `created_at`, `conflict_especie_id`, `conflict_especie_nombre`)
  SELECT `id`, `subgrupo_id`, `especie_id`, `posicion`, `sub_id`, `foto_url`, `foto_synced`, `plantacion_id`, `global_id`, `usuario_registro`, `created_at`, `conflict_especie_id`, `conflict_especie_nombre` FROM `trees`;
--> statement-breakpoint
DROP TABLE `trees`;
--> statement-breakpoint
DROP TABLE `subgroups`;
--> statement-breakpoint
ALTER TABLE `trees_new` RENAME TO `trees`;
--> statement-breakpoint
CREATE UNIQUE INDEX `groups_parcela_code_unique` ON `groups` (`parcela_id`,`codigo`);
--> statement-breakpoint
CREATE UNIQUE INDEX `groups_parcela_name_unique` ON `groups` (`parcela_id`,`nombre`);
--> statement-breakpoint
CREATE UNIQUE INDEX `parcelas_plantation_code_unique` ON `parcelas` (`plantacion_id`,`codigo`);
--> statement-breakpoint
CREATE UNIQUE INDEX `parcelas_plantation_name_unique` ON `parcelas` (`plantacion_id`,`nombre`);
