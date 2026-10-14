-- Edición por campo con conflictos (#634). Solo cliente.
-- base_de_edicion: JSON con lo que el server tenía al entrar en edición offline; el pull
-- no lo toca (a diferencia de los *_server), así el push manda la base real.
-- conflictos_de_edicion: JSON con los campos que chocaron con la web, hasta que se elija.
ALTER TABLE `plantations` ADD `base_de_edicion` text;--> statement-breakpoint
ALTER TABLE `plantations` ADD `editada_localmente_en` text;--> statement-breakpoint
ALTER TABLE `plantations` ADD `conflictos_de_edicion` text;
