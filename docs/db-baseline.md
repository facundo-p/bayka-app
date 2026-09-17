# Baseline de la base de datos (#283)

## Fuente de verdad

`supabase/baseline_schema.sql` es el schema completo y auto-contenido tal
como quedó tras la última regeneración (hoy incluye hasta 030). No es
histórico: es el estado que se busca alcanzar. **Regla de archivado: una
migración se mueve a `supabase/migrations/archive/` recién cuando ya está
aplicada en prod** — no cuando se funde en la baseline. Por eso puede haber
migraciones (como 030 hoy) que ya están en la baseline pero siguen viviendo
en `supabase/migrations/` porque prod todavía no las corrió; ese archivado
pendiente se hace en el mismo momento en que se regenera la baseline tras
aplicar a prod. Las ya archivadas viven, solo como referencia, en
`supabase/migrations/archive/` (no replayables desde cero: algunas, como
013-015, son migraciones de **datos** de un momento puntual, no de esquema).

## Migraciones nuevas

Todo cambio de esquema nuevo va en `supabase/migrations/NNN_descripcion.sql`
(numeración siguiente a la última archivada). Regla dura: **debe poder
aplicarse sobre una base vacía** (baseline + migraciones pendientes, sin
datos). Si una migración necesita tocar filas existentes de un ambiente real
(backfill, limpieza puntual), esa parte va aparte en
`supabase/migrations/data/`, nunca mezclada con el cambio de esquema
replayable.

Idempotencia: `IF EXISTS` / `IF NOT EXISTS` / `DROP POLICY IF EXISTS` antes de
`CREATE POLICY`, etc. — mismo criterio que ya usa 030.

## Crear un ambiente desde cero

1. Aplicar `supabase/baseline_schema.sql` + todo `supabase/migrations/*.sql`
   pendiente (es literalmente lo que hace
   `supabase/tests/run-db-tests.sh`, contra un stack local).
2. Configuración manual que ningún SQL cubre (issue #249): crear el proyecto
   Supabase, variables de entorno de la app, Auth (proveedores, redirect
   URLs), y credenciales cargadas en Bitwarden del cliente.

## Regenerar la baseline

Después de aplicar migraciones nuevas a prod (nunca antes: la baseline y el
archivado reflejan un estado real, no uno planeado):
`supabase/tests/regenerate-baseline.sh`. Automatiza: levantar un stack local
con la baseline actual + las migraciones pendientes, `supabase db dump
--schema public`, y pegarle `supabase/tests/baseline-extras.sql` (objetos
fuera de `public` que un dump de un solo schema no trae: bucket de storage,
triggers sobre `auth.users`). El script no archiva nada — eso es manual,
después de confirmar `supabase/tests/run-db-tests.sh` en verde: recién ahí
esas migraciones pasan a `supabase/migrations/archive/`. Detalle completo en
`supabase/tests/README.md`.
