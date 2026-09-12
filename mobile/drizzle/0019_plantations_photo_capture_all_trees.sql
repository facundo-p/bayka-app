-- Foto en todos los botones de la botonera (#439), administrada desde la web de
-- gestión (espejo de plantations.photo_capture_all_trees en Supabase). Default 0
-- (solo N/N pide foto): coincide con el default del server y cubre devices que
-- aún no recibieron el dato. Default duplicado de constants/photoCapture.ts
-- (PHOTO_CAPTURE_ALL_TREES_DEFAULT=false → 0). SQL no puede importar la constante.
ALTER TABLE `plantations` ADD `photo_capture_all_trees` integer NOT NULL DEFAULT 0;
