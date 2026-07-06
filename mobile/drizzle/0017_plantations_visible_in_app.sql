-- Visibilidad de la plantación en la app móvil, administrada desde la web de
-- gestión (espejo de plantations.visible_in_app en Supabase). Default 1
-- (visible): coincide con el default del server y cubre devices que aún no
-- recibieron el dato. Los técnicos no ven plantaciones ocultas en el listado;
-- el sync de datos pendientes no se ve afectado.
ALTER TABLE `plantations` ADD `visible_in_app` integer NOT NULL DEFAULT 1;
