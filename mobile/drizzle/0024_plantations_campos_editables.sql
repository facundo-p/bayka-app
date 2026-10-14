-- Datos de la plantación editables desde mobile (#633): espejo de las columnas de
-- Supabase, más snapshots *_server (solo cliente) para descartar una edición offline
-- y, en #634, calcular qué campos cambió cada lado. Null en un snapshot = sin dato.
ALTER TABLE `plantations` ADD `descripcion` text;--> statement-breakpoint
ALTER TABLE `plantations` ADD `fecha_inicio` text;--> statement-breakpoint
ALTER TABLE `plantations` ADD `objetivo_arboles` integer;--> statement-breakpoint
ALTER TABLE `plantations` ADD `descripcion_server` text;--> statement-breakpoint
ALTER TABLE `plantations` ADD `fecha_inicio_server` text;--> statement-breakpoint
ALTER TABLE `plantations` ADD `objetivo_arboles_server` integer;--> statement-breakpoint
ALTER TABLE `plantations` ADD `photo_capture_all_trees_server` integer;--> statement-breakpoint
ALTER TABLE `plantations` ADD `visible_in_app_server` integer;--> statement-breakpoint
-- Hasta acá foto y visibilidad solo se editaban online: el valor local es el del server.
UPDATE `plantations` SET `photo_capture_all_trees_server` = `photo_capture_all_trees`, `visible_in_app_server` = `visible_in_app`;
