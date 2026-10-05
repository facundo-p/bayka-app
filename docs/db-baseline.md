# Baseline y migraciones de la base de datos (#283, #759)

## Fuente de verdad

`supabase/baseline_schema.sql` es el schema completo y auto-contenido hasta la
030. Encima van todas las migraciones de `supabase/migrations/`, de la 030 en
adelante. Las de `supabase/migrations/archive/` (hasta la 029) quedan solo como
referencia: no son replayables desde cero, porque algunas, como 013-015, son
migraciones de **datos** de un momento puntual.

**No se archiva más como rutina** (decisión de Facu, 2026-10-05). Con el
registro de migraciones, `supabase db push` exige que cada versión registrada
en la base siga existiendo en `supabase/migrations/`: mover una a `archive/`
rompe el push en los entornos que la tienen registrada.

## Aplicar migraciones

Cada base registra qué migraciones tiene en `supabase_migrations.schema_migrations`,
la tabla estándar de la CLI de Supabase. **Las migraciones se aplican solo con
`supabase db push`**, nunca pegándolas en el SQL Editor: el push aplica cada
una en su transacción y la registra al terminar. Si una falla, se frena ahí,
y lo que falta queda a la vista en el registro.

Antes, en staging se aplicaban a mano. Así, la 038 nunca corrió, y 039, 045,
047, 048 y 049 fallaron y se revirtieron sin que nadie lo notara (#759).

Con la URL de `.env.migration` (`STAGING_DB_URL` o `PROD_DB_URL`) y la versión
de la CLI fijada en `supabase/tests/lib.sh`:

```sh
URL="$(grep '^STAGING_DB_URL=' .env.migration | cut -d= -f2-)"
npx --yes supabase@2.116.0 migration list --db-url "$URL"         # drift: Local vs Remote
npx --yes supabase@2.116.0 db push --dry-run --db-url "$URL"      # qué aplicaría
npx --yes supabase@2.116.0 db push --db-url "$URL"                # aplica y registra
```

- **El push real lo corre Facu.** Claude corre solo `migration list` y
  `--dry-run`, y le pasa el comando exacto con `/migrar`. Ese comando funciona
  desde cualquier directorio. Los de arriba, en cambio, solo funcionan en el
  checkout principal y en la rama del entorno: en un worktree no encuentran
  `.env.migration` y aplicarían las migraciones de otra rama.
- **Orden:** staging primero; prod recién con el pase a `main` y confirmación
  dedicada.
- **Una migración que figura antes de la última registrada** (porque falló o se
  salteó) solo se aplica con `--include-all`. El dry-run la muestra.
- **`migration repair --status applied <versiones>`** marca como aplicadas
  migraciones que ya están en la base sin correrlas. Sirve para un entorno
  restaurado o creado a mano. Antes de usarlo, verificar contra el schema que
  de verdad estén.

## Migraciones nuevas

Todo cambio de esquema nuevo va en `supabase/migrations/NNN_descripcion.sql`,
con la numeración siguiente a la última. Regla dura: **debe poder aplicarse
sobre una base vacía** (baseline + migraciones anteriores, sin datos). Si una
migración necesita tocar filas existentes de un ambiente real (backfill,
limpieza puntual), esa parte va aparte en `supabase/migrations/data/`, que el
push no lee, nunca mezclada con el cambio de esquema.

Idempotencia: `IF EXISTS` / `IF NOT EXISTS` / `DROP POLICY IF EXISTS` antes de
`CREATE POLICY`, etc.

## Crear un ambiente desde cero

1. Aplicar `supabase/baseline_schema.sql` con `psql`, y después `db push` de
   todo `supabase/migrations/`. La 030 ya está en la baseline y se reaplica, lo
   que es seguro porque es idempotente. Equivale a lo que hace
   `supabase/tests/run-db-tests.sh` contra un stack local.
2. Configuración manual que ningún SQL cubre (#249): crear el proyecto
   Supabase, variables de entorno de la app, Auth (proveedores, redirect
   URLs), y credenciales cargadas en Bitwarden del cliente.

## Regenerar la baseline

Ya no es rutina. `supabase/tests/regenerate-baseline.sh` sigue disponible:
levanta un stack local con la baseline actual + las migraciones, corre
`supabase db dump --schema public` y le pega `supabase/tests/baseline-extras.sql`
(objetos fuera de `public` que un dump de un solo schema no trae: bucket de
storage, triggers sobre `auth.users`). Detalle en `supabase/tests/README.md`.

Si alguna vez se regenera y se archivan migraciones, es una decisión puntual:
hay que correr `migration repair --status reverted <versiones>` de las
archivadas en cada base que las tenga registradas; sin eso, `db push` falla.
