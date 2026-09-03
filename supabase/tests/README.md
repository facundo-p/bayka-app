# Tests de base (pgTAP)

## Por qué un harness y no `supabase db reset` directo (#283, #308)

`supabase test db` corre pgTAP contra el resultado de aplicar
`supabase/migrations/*.sql` en orden. Ese directorio no se puede resetear tal
cual desde una base vacía: las migraciones 013–015 son migraciones de **datos**
(consolidación/borrado de plantaciones reales de un momento puntual, #283), no
de esquema, y asumen filas que no existen en una base nueva.

Este harness arma, en `supabase/.tmp-dbtest/` (gitignored, se recrea en cada
corrida), un proyecto Supabase temporal cuyas migraciones son:

1. `supabase/baseline_schema.sql` (snapshot de esquema que ya incluye hasta la
   migración 029), renombrado a `20260101000000_baseline.sql`.
2. Todas las migraciones con prefijo numérico **mayor a 029** (hoy solo la
   030), re-prefijadas con timestamps posteriores al de la baseline —el CLI
   ordena por nombre de archivo completo como string, y `"030_..."` ordena
   *antes* que `"20260101000000_..."` porque `'0' < '2'`.

Después de #283 (re-baseline real del proyecto), la lista de "posteriores a
029" se va a ir corriendo sola a medida que se sume esa migración al filtro
`> N`; en algún momento conviene volver a generar `baseline_schema.sql` desde
cero y bajar el número de corte en `run-db-tests.sh`.

## Cómo correr

```sh
supabase/tests/run-db-tests.sh
```

Requiere Docker corriendo. Usa `npx supabase@latest` (no hace falta el CLI
instalado global). Deja el resultado de `supabase test db` (formato TAP) en
stdout y para el stack al salir.

Para dejar el stack temporal levantado y poder inspeccionarlo a mano (p.ej.
con `psql`) después de la corrida:

```sh
DB_TEST_KEEP_RUNNING=1 supabase/tests/run-db-tests.sh
# luego, a mano:
npx supabase@latest stop --workdir supabase/.tmp-dbtest --no-backup
```

El proyecto temporal usa `project_id` y puertos propios (55321/55322/...) para
no pisar un stack de desarrollo que ya esté corriendo con `supabase/config.toml`
(54321/54322/...).

## En CI

`.github/workflows/db-tests.yml` corre este mismo script en cada PR/push que
toque `supabase/**`, con Docker ya disponible en `ubuntu-latest`.

## Filtros aplicados a `baseline_schema.sql`

`run-db-tests.sh` no usa `baseline_schema.sql` tal cual: es un dump
estilo `pg_dump` (probablemente `--schema=public`) que trae algunos
artefactos que no aplican como migración sobre un stack local recién
creado por el CLI. Cada uno, y por qué:

- `SELECT pg_catalog.set_config('search_path', '', false);` — pone el
  `search_path` vacío para el resto del dump. Rompe la resolución de
  `extensions.*` (p.ej. `gen_random_uuid()`) al aplicarse como migración
  normal del CLI, que sí depende del `search_path` de sesión. Se quita.
- `SET row_security = off;` — venía inmediatamente después de la línea
  anterior con el mismo propósito (dump sin RLS de por medio). No hace falta
  fuera de un `pg_restore` y se quita junto con ella.
- `CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";` —
  `supabase_vault` ya viene preinstalada por la imagen local del CLI en el
  schema `vault`; volver a crearla explícitamente desde una migración choca
  con objetos que la imagen ya inicializó. Se quita esa línea puntual (el
  resto de los `CREATE EXTENSION IF NOT EXISTS` sí aplican limpio, son
  idempotentes).
- **Faltan los triggers de `auth.users`** (`trg_handle_new_user`,
  `trg_sync_profile_email`, migración 026): `baseline_schema.sql` es un dump
  del schema `public` únicamente, y esos dos triggers cuelgan de
  `auth.users`, fuera de ese schema — igual que sus funciones
  (`handle_new_user()`, `sync_profile_email()`), que sí están en la baseline
  porque viven en `public`. Sin esos triggers, insertar en `auth.users` no
  auto-crea la fila en `profiles`, y **todos** los fixtures de test dependen
  de ese auto-provisioning (todo lo que referencia un usuario —
  `plantation_users`, `groups`, `trees` — tiene FK a `profiles`, no
  directamente a `auth.users` en el caso de `plantation_users`). El script
  agrega ambos triggers al final de la migración armada, con el mismo cuerpo
  que la 026.

No hicieron falta filtros para: `ALTER ... OWNER TO "postgres"` (el CLI migra
como superusuario, no falla), `GRANT`/`ALTER DEFAULT PRIVILEGES` (roles
`anon`/`authenticated`/`service_role` ya existen en la imagen local), ni
`ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres"` (la publicación ya
la crea la imagen local antes de migrar). El dump no trae `\restrict`/
`\connect` ni otras directivas de `psql`.

## Autenticación simulada en los tests

`auth.uid()` en este proyecto lee, en orden:
`request.jwt.claim.sub` y, si no está, `request.jwt.claims->>'sub'` (ver
definición en `baseline_schema.sql`). Cada test simula un usuario autenticado
así, dentro de la misma transacción de la que hace rollback al final:

```sql
set local role authenticated;
select set_config('request.jwt.claim.sub', '<uuid-del-usuario>', true);
```

El tercer argumento `true` de `set_config` es "local a la transacción": no
hace falta resetearlo entre asserts, pero si el archivo simula más de un
usuario alcanza con volver a llamar `set_config` con el otro uuid (y, para
volver a operar con privilegios de superusuario entre fixtures, `reset role;`).

## Contenido de los tests

- `01_groups_insert_membership.test.sql` — la policy de `groups` INSERT
  (030, #306) exige creador **y** miembro de la plantación.
- `02_parcelas_insert_membership.test.sql` — guarda de regresión: `parcelas`
  INSERT ya era correcta antes de esta migración.
- `03_sync_subgroup.test.sql` — guard de membresía interno de `sync_subgroup`
  (028): un no-miembro recibe `{success:false, error:'PERMISSION'}`, sin
  insertar nada; un miembro sincroniza grupo + árboles.
- `04_generate_tree_ids.test.sql` — `generate_tree_ids` (029) es un gate por
  **rol global** (admin/superadmin), no por membresía: un técnico recibe
  `NOT_AUTHORIZED`, un admin genera los IDs.
- `05_update_tree_ids_removed.test.sql` — `update_tree_ids(jsonb)` (020) ya
  no existe tras la 030.
- `06_schema_hardening.test.sql` — resto de la 030: índices de
  `groups.plantation_id` / `trees.group_id`, `groups.parcela_id NOT NULL`,
  `subgroups_estado_check` eliminada, `search_path=public` fijo en las 4
  funciones `SECURITY DEFINER` que lo tenían pendiente.
- `07_trees_insert_membership.test.sql` — mismo gap que `groups` INSERT, pero
  en `trees`: la policy legacy ("Users can insert own trees") se retira en la
  030 por quedar redundante/insegura frente a "Plantation members can insert
  trees" (011), que ya exige membresía. Cubre no-miembro rechazado, miembro
  aceptado, y que la policy legacy ya no está en `pg_policies`.

## Hallazgos fuera de alcance de esta migración (reportados, no corregidos)

- `sync_subgroup` (028) inserta `groups.parcela_id` directo desde
  `(p_subgroup->>'parcela_id')::UUID` sin validar que la clave venga presente
  en el payload; un cliente que la omita pasaría `NULL` y violaría el
  `NOT NULL` agregado en la 030. No se tocó `sync_subgroup` en esta
  migración; pendiente de validar en el cliente o en la función.
