# scripts/deferred/

Operaciones planificadas pero **no agendadas para ejecución**. Quedan acá para que se puedan invocar manualmente cuando se decida.

**Estas operaciones NO corren en CI, NO están referenciadas en ningún plan activo, y NO forman parte de la cadena de migrations de Supabase.**

## Inventario

### `delete-deprecated-medio-p4.sql` + `delete-deprecated-medio-p4-photos.mjs`

Borra la plantación `SSS-Medio-P4-deprecated` (UUID `51fea9e5-2537-4cef-82fd-c07d6375dbf0`) que quedó como vestigio tras `012c_rename_pp_to_medio_p4.sql`.

**Estado:** Decidido en 2026-05-22 — el usuario prefiere mantenerla viva por ahora. Cuando se decida limpiar:

1. Correr `delete-deprecated-medio-p4-photos.mjs` con `SUPABASE_SERVICE_KEY` para borrar archivos físicos del bucket `tree-photos` bajo `plantations/51fea9e5-.../trees/*.jpg`.
2. Correr `delete-deprecated-medio-p4.sql` en SQL Editor para borrar la fila + CASCADE (grupos + árboles + plantation_users + plantation_species).

**Datos al momento de planificar la limpieza (snapshot 2026-05-22):** 2 grupos, 117 árboles, fotos asociadas (verificar conteo real con el script en modo `--dry-run` antes de ejecutar).
