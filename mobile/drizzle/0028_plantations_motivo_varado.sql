-- Pendientes varados (#638). Solo local: por qué lo pendiente de la plantación no
-- puede subir (finalizada, archivada, sin permiso), null = nada varado; y si el
-- insert de un alta ya llegó al server aunque falte terminarla.
ALTER TABLE `plantations` ADD `motivo_varado` text;--> statement-breakpoint
ALTER TABLE `plantations` ADD `alta_en_servidor` integer DEFAULT 0 NOT NULL;
