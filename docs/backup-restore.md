# Backup y restore de la base

Un backup que nunca se restauró es una hipótesis. Esto documenta las dos
mitades: cómo se hace el backup y cómo se ensaya el restore sin tocar ninguna
base real.

## El backup

`.github/workflows/supabase-backup.yml`, todos los días a las 2am AR, y también
a mano con `workflow_dispatch`. Corre `scripts/supabase-backup.sh`, que:

1. `pg_dump --format=custom --no-owner --no-acl` de la base que apunte el secret
   `SUPABASE_DB_URL`;
2. sube el `.dump` a Cloudflare R2, bajo el prefijo `supabase-backups/`;
3. rota: deja los 10 más recientes.

Los cinco secrets del repo que necesita: `SUPABASE_DB_URL`, `R2_ENDPOINT`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`.

### Qué entra y qué no

El dump es de la base entera, no solo de `public`: trae `auth` (usuarios e
identidades, así que un restore no deja a nadie afuera) y las **filas** de
`storage.objects`. Dos cosas quedan afuera, y las dos importan:

- **Los archivos de Storage.** Viajan las filas que describen cada foto, no los
  bytes. Restaurar el dump deja 148 registros apuntando a archivos que solo
  existen en el bucket de Supabase. Respaldarlos es #603.
- **`supabase_migrations.schema_migrations`**, el registro de qué migraciones se
  aplicaron. Un proyecto restaurado desde este dump tiene el schema al día pero
  no lo sabe, y el próximo `db push` intenta reaplicar todo desde cero. Al
  restaurar sobre un proyecto nuevo hay que repoblar esa tabla a mano con las
  migraciones que el dump ya trae aplicadas.

## El ensayo de restore

```sh
scripts/restore-backup.sh <archivo.dump>
scripts/restore-backup.sh --conservar <archivo.dump>   # deja la base viva para mirarla
```

Levanta un Postgres efímero en Docker, restaura el dump ahí y cuenta lo que
quedó: filas por tabla de `public`, y cuántas funciones, policies y triggers.
Al terminar borra el contenedor, salvo `--conservar`.

Dos decisiones del script que conviene conocer:

- **Los clientes salen de la imagen, no de la laptop.** `pg_dump` en CI es 17;
  un `pg_restore` más viejo se niega a leer ese dump. El script corre
  `pg_restore` y `psql` dentro del contenedor, así que alcanza con Docker.
- **Crea los roles de Supabase antes de restaurar** (`anon`, `authenticated`,
  `service_role`, `authenticator`, `supabase_admin`, `supabase_auth_admin`,
  `supabase_storage_admin`, `dashboard_user`, `pgbouncer`). El dump les hace
  GRANT y sin ellos el restore se llena de errores. Crearlos es parte del
  procedimiento real de restore, no un atajo del ensayo.

### Qué errores son esperables

Un Postgres pelado no tiene las extensiones gestionadas de Supabase. Los únicos
tres errores esperables son de `supabase_vault`:

```
extension "supabase_vault" is not available
extension "supabase_vault" does not exist
relation "vault.secrets" does not exist
```

Eso no afecta al schema del dominio. Cualquier cuarto error es una señal.

### Restore verificado de un backup real de producción

`backup-20260922-094203.dump` (632 KB), bajado de R2 y restaurado el
2026-09-22. Es el ensayo que cierra #251: el backup que el cron dejó en R2, no
un dump generado a mano para la ocasión.

| | |
|---|---|
| `trees` | 7124 |
| `groups` / `parcelas` / `plantations` | 233 / 17 / 1 |
| `species` / `plantation_species` | 54 / 44 |
| `profiles` / `plantation_users` | 2 / 2 |
| `auth.users` / `auth.identities` | 2 / 2 |
| `storage.objects` (filas, no archivos) | 148 |
| Funciones / policies / triggers en `public` | 35 / 26 / 3 |
| Errores | 3, todos de `supabase_vault` |

Los 7124 árboles son San Sebastián de la Selva entera, que es el grueso de la
base. La data está completa.

### Comparar el dump contra el repo

El recuento dice que el restore anduvo; no dice si la base de origen tiene el
schema que el repo cree. Eso se compara **sobre el dump**, sin abrir una sola
conexión a producción: se levantan las dos bases y se diffean los nombres y los
cuerpos.

```sh
scripts/restore-backup.sh --conservar <archivo.dump>      # deja bayka-restore-<pid>
DB_TEST_KEEP_RUNNING=1 supabase/tests/run-db-tests.sh     # baseline + migraciones

DEF="select p.proname||'|'||md5(pg_get_functiondef(p.oid)) as d
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' order by 1"
docker exec bayka-restore-<pid>            psql -U postgres -d postgres -tAc "$DEF" > /tmp/dump.txt
docker exec supabase_db_bayka-web-v1-dbtest psql -U postgres -d postgres -tAc "$DEF" > /tmp/repo.txt
diff /tmp/dump.txt /tmp/repo.txt
```

Lo mismo para las policies, con `md5(coalesce(qual,'')||'~'||coalesce(with_check,''))`
sobre `pg_policies`. Un alias (`as d`) en el select evita el `ORDER BY position`
que se lleva puesto el query y devuelve dos archivos vacíos que diffean igual.

En la corrida del 2026-09-22, contra el repo en `052`: las 26 policies
idénticas una por una y las 34 funciones del repo con el cuerpo idéntico. La
única diferencia fue `rls_auto_enable` (35 vs 34), un event trigger que Supabase
instala solo para activar RLS en cada tabla nueva de `public`: es de la
plataforma, no sale de ninguna migración y no se versiona.

Por eso el recuento crudo de funciones de un proyecto Supabase da uno más que el
harness de pgTAP. No es drift.

## Restore de verdad, sobre un entorno

El ensayo prueba el dump. Poner esa base en un proyecto de Supabase es otra
cosa: va contra la URL del proyecto destino, con los roles ya existentes, y
conviene hacerlo sobre un proyecto vacío o pausable antes que sobre uno en uso.
Además hay que repoblar `supabase_migrations.schema_migrations` y recuperar los
archivos de Storage, que el dump no trae.
