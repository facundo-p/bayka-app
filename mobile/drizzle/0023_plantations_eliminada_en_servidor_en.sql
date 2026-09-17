-- Plantación eliminada en el servidor (#478). Solo local, sin espejo en Supabase: la
-- setea el pull cuando el server la reporta eliminada; null = existe.
ALTER TABLE `plantations` ADD `eliminada_en_servidor_en` text;
