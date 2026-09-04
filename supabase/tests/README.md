# Tests de base (pgTAP)

## Flujo

Baseline + migraciones archivadas vs. pendientes: ver `docs/db-baseline.md`
(fuente de verdad de esa historia, no la repitas acá).

`run-db-tests.sh` arma, en `supabase/.tmp-dbtest/` (gitignored, recreado en
cada corrida), un proyecto temporal: baseline (copiada como
`00000000_baseline.sql`, ordena primero sin importar el prefijo real) + todo
`supabase/migrations/*.sql`. Sin filtros ni renombrados: la baseline ya sale
curada de `regenerate-baseline.sh`.

## Cómo correr

`supabase/tests/run-db-tests.sh` — requiere Docker. Usa el `supabase` del
PATH si existe (CI, vía `supabase/setup-cli@v1`, mismo pin que
`supabase/tests/lib.sh`) o `npx supabase@<versión pinneada>` si no. Puertos y
proyecto propios (55321+) para no pisar un stack de desarrollo (54321+). Para
dejar el stack levantado: `DB_TEST_KEEP_RUNNING=1
supabase/tests/run-db-tests.sh`, luego `npx supabase@<versión> stop
--workdir supabase/.tmp-dbtest --no-backup`. `.github/workflows/db-tests.yml`
corre lo mismo en cada PR/push a `supabase/**`.

`run-db-tests.sh` y `regenerate-baseline.sh` usan `supabase db start`
(levanta solo el contenedor de Postgres) en vez de `supabase start` (~13
contenedores): `test db`/pgTAP y `db dump` corren contra la conexión directa
a Postgres, no necesitan kong/gotrue/storage-api/etc. Verificado: el schema
`storage` (tablas, y el bucket + policies de `storage.objects` que agrega
`baseline-extras.sql`) ya vienen en la imagen de Postgres de Supabase, sin
depender del contenedor `storage-api`. `db start` sobre un volumen nuevo
aplica baseline + migraciones directo (no hace falta `db reset` después);
`run-db-tests.sh` solo resetea si detecta un volumen reusado de una corrida
anterior con `DB_TEST_KEEP_RUNNING=1`.

## Regenerar la baseline

Cuándo y cómo regenerar/archivar: ver `docs/db-baseline.md`. Mecánica del
script (`regenerate-baseline.sh`): stack con baseline + migraciones
pendientes → `db dump --schema public` → agrega `baseline-extras.sql`.

`baseline-extras.sql` trae lo que un dump de un solo schema no incluye:
bucket `tree-photos` + policies de `storage.objects` (008), y los triggers
`trg_handle_new_user`/`trg_sync_profile_email` sobre `auth.users` (026; sus
funciones sí están en el dump, viven en `public`).

## Autenticación simulada

`auth.uid()` lee `request.jwt.claim.sub`. Cada test simula un usuario dentro
de la transacción de la que hace rollback:
`set local role authenticated; select set_config('request.jwt.claim.sub',
'<uuid>', true);` — `reset role;` vuelve a superusuario entre fixtures.

## Tests

`01`-`02` membresía en INSERT (groups/parcelas), `03` guard de
`sync_subgroup`, `04` gate por rol de `generate_tree_ids`, `05`
`update_tree_ids` removida, `06` resto de 030, `07` mismo fix en `trees`
INSERT, `08` DELETE de `plantations` solo admin/superadmin (031, #300), `09`
helpers de estado/seed de `global_id` (032, #309), `10` SELECT scoped por
membresía/organización, incluida `storage.objects` de `tree-photos` (033,
#310).

## Hallazgo fuera de alcance (no corregido)

`sync_subgroup` (028) inserta `groups.parcela_id` sin validar que venga en el
payload; un cliente que la omita dispara el NOT NULL de 030 (23502), pero
`sync_subgroup` atrapa cualquier excepción (`EXCEPTION WHEN OTHERS`) y
responde `{success: false, error: 'UNKNOWN'}` — el cliente nunca ve el
23502 crudo.
