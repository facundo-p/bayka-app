-- Captura GPS en registro de árboles (milestone GPS, issue #96).
-- trees: punto capturado al registrar (nullable: árboles históricos quedan sin punto).
-- plantations: configuración por plantación (frecuencia de captura y obligatoriedad).
-- Defaults duplicados de constants/gpsCapture.ts (GPS_CAPTURE_FREQUENCY_DEFAULT=10).
ALTER TABLE `trees` ADD `latitude` real;--> statement-breakpoint
ALTER TABLE `trees` ADD `longitude` real;--> statement-breakpoint
ALTER TABLE `trees` ADD `gps_accuracy` real;--> statement-breakpoint
ALTER TABLE `trees` ADD `gps_captured_at` text;--> statement-breakpoint
ALTER TABLE `plantations` ADD `gps_capture_frequency` integer NOT NULL DEFAULT 10;--> statement-breakpoint
ALTER TABLE `plantations` ADD `gps_capture_required` integer NOT NULL DEFAULT 1;
