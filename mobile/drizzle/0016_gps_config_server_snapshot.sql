-- Snapshot local del valor de server de la config GPS (milestone GPS, issue #100/#103 review).
-- Espeja el patrón lugar_server/periodo_server: permite que discardPlantationEdit
-- revierta una edición offline de frecuencia/obligatoriedad GPS. Nullable (null =
-- sin snapshot todavía). Columnas solo-cliente, no existen en Supabase.
ALTER TABLE `plantations` ADD `gps_capture_frequency_server` integer;--> statement-breakpoint
ALTER TABLE `plantations` ADD `gps_capture_required_server` integer;
