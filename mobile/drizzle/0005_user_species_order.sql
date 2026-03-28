-- Migration 0005: Per-user species button order
-- Each user can customize the order of species buttons in the botonera.
-- Falls back to plantation_species.orden_visual when no custom order exists.
CREATE TABLE `user_species_order` (
	`user_id` text NOT NULL,
	`plantacion_id` text NOT NULL,
	`especie_id` text NOT NULL,
	`orden_visual` integer NOT NULL,
	FOREIGN KEY (`plantacion_id`) REFERENCES `plantations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`especie_id`) REFERENCES `species`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_species_order_pk` ON `user_species_order` (`user_id`,`plantacion_id`,`especie_id`);
