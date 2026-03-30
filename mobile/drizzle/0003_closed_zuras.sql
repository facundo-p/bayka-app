CREATE TABLE `plantation_users` (
	`plantation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`rol_en_plantacion` text DEFAULT 'tecnico' NOT NULL,
	`assigned_at` text NOT NULL,
	FOREIGN KEY (`plantation_id`) REFERENCES `plantations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plantation_users_pk` ON `plantation_users` (`plantation_id`,`user_id`);