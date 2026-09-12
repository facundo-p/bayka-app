-- Migration 035: foto en todos los botones de la botonera (#439).
--
-- plantations.photo_capture_all_trees: si está activo, en la Bayka App cada
-- botón de especie pide foto antes de registrar el árbol, igual que N/N.
-- Default false: las plantaciones existentes no cambian de comportamiento.
-- Lo edita solo la web de gestión (Configuración → Comportamiento en la app);
-- la app lo lee vía sync. Default duplicado en mobile/src/constants/photoCapture.ts
-- (PHOTO_CAPTURE_ALL_TREES_DEFAULT) y en la migración local 0019.
-- Sin RLS nueva: la policy de UPDATE para admin/superadmin ya cubre la columna.

alter table plantations
  add column photo_capture_all_trees boolean not null default false;
