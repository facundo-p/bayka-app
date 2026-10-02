-- Cierra el UPDATE directo de los campos editables de `plantations` (#649).
--
-- Desde #634 web y mobile editan por `editar_plantacion`, que compara cada campo
-- con el valor que el cliente vio. Con los APKs anteriores ya fuera de uso, el
-- UPDATE directo solo servía para pisar cambios de otros sin conflicto.
--
-- `estado` conserva el UPDATE: finalizar sigue siendo `activa → finalizada` desde
-- mobile (la limita `trg_proteger_estado_de_plantacion`, 057). `editar_plantacion`
-- es SECURITY DEFINER y corre como postgres: no depende de estos privilegios.

REVOKE UPDATE (
  "lugar", "periodo", "descripcion", "fecha_inicio", "objetivo_arboles",
  "gps_capture_frequency", "gps_capture_required", "photo_capture_all_trees", "visible_in_app"
) ON TABLE "public"."plantations" FROM "authenticated";
