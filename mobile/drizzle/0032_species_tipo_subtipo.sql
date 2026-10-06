-- Tipo y subtipo de la especie (#752), con los DEFAULT de contracts/tipos-especie.json,
-- los mismos que en el server. Las especies que ya están quedan como flora / arbol
-- hasta que el pull del catálogo traiga las del server.
ALTER TABLE `species` ADD `tipo` text DEFAULT 'flora' NOT NULL;--> statement-breakpoint
ALTER TABLE `species` ADD `subtipo` text DEFAULT 'arbol' NOT NULL;
