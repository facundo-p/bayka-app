-- Código de plantación (#559), con su snapshot del server. Nullable acá aunque en
-- Supabase sea NOT NULL: las filas previas lo reciben recién en el próximo pull.
ALTER TABLE `plantations` ADD `codigo` text;--> statement-breakpoint
ALTER TABLE `plantations` ADD `codigo_server` text;
