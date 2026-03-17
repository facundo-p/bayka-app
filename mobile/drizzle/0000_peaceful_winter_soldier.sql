CREATE TABLE `plantations` (
	`id` text PRIMARY KEY NOT NULL,
	`organizacion_id` text NOT NULL,
	`lugar` text NOT NULL,
	`periodo` text NOT NULL,
	`estado` text DEFAULT 'activa' NOT NULL,
	`creado_por` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `species` (
	`id` text PRIMARY KEY NOT NULL,
	`codigo` text NOT NULL,
	`nombre` text NOT NULL,
	`nombre_cientifico` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `species_codigo_unique` ON `species` (`codigo`);--> statement-breakpoint
CREATE TABLE `subgroups` (
	`id` text PRIMARY KEY NOT NULL,
	`plantacion_id` text NOT NULL,
	`nombre` text NOT NULL,
	`codigo` text NOT NULL,
	`tipo` text DEFAULT 'linea' NOT NULL,
	`estado` text DEFAULT 'recording' NOT NULL,
	`usuario_creador` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`plantacion_id`) REFERENCES `plantations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `trees` (
	`id` text PRIMARY KEY NOT NULL,
	`subgrupo_id` text NOT NULL,
	`especie_id` text,
	`posicion` integer NOT NULL,
	`sub_id` text NOT NULL,
	`foto_url` text,
	`usuario_registro` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`subgrupo_id`) REFERENCES `subgroups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`especie_id`) REFERENCES `species`(`id`) ON UPDATE no action ON DELETE no action
);
