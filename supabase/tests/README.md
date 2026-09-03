# Tests de base (pgTAP)

## Flujo (post re-baseline, #283)

`supabase/baseline_schema.sql` es un snapshot completo y auto-contenido del
schema (= staging/prod tras la última migración archivada, hoy 030). Las
migraciones viejas (001-030) están en `supabase/migrations/archive/`
(histórico, no replayable: 013-015 tocan datos puntuales). `supabase/migrations/`
solo tiene migraciones nuevas. Detalle en `docs/db-baseline.md`.

`run-db-tests.sh` arma, en `supabase/.tmp-dbtest/` (gitignored, recreado en
cada corrida), un proyecto temporal: baseline (copiada como
`00000000_baseline.sql`, ordena primero sin importar el prefijo real) + todo
`supabase/migrations/*.sql`. Sin filtros ni renombrados: la baseline ya sale
curada de `regenerate-baseline.sh`.

## Cómo correr

`supabase/tests/run-db-tests.sh` — requiere Docker. Usa el `supabase` del
PATH si existe (CI, vía `supabase/setup-cli@v1`) o `npx supabase@latest` si
no. Puertos y proyecto propios (55321+) para no pisar un stack de desarrollo
(54321+). Para dejar el stack levantado: `DB_TEST_KEEP_RUNNING=1
supabase/tests/run-db-tests.sh`, luego `npx supabase@latest stop --workdir
supabase/.tmp-dbtest --no-backup`. `.github/workflows/db-tests.yml` corre lo
mismo en cada PR/push a `supabase/**`.

## Regenerar la baseline

Tras aplicar migraciones nuevas a staging/prod: `regenerate-baseline.sh`
(stack con baseline + esas migraciones → `db dump --schema public` → agrega
`baseline-extras.sql`). No archiva nada: revisá el diff, confirmá
`run-db-tests.sh` en verde, y recién `git mv` esas migraciones a
`migrations/archive/`.

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
INSERT, `08` DELETE de `plantations` solo admin/superadmin (031, #300).

## Hallazgo fuera de alcance (no corregido)

`sync_subgroup` (028) inserta `groups.parcela_id` sin validar que venga en el
payload; un cliente que la omita violaría el NOT NULL de 030.
