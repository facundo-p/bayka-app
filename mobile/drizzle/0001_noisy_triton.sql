CREATE TABLE `plantation_species` (
	`id` text PRIMARY KEY NOT NULL,
	`plantacion_id` text NOT NULL,
	`especie_id` text NOT NULL,
	`orden_visual` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`plantacion_id`) REFERENCES `plantations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`especie_id`) REFERENCES `species`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subgroups_plantation_code_unique` ON `subgroups` (`plantacion_id`,`codigo`);