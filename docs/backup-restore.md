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

**Solo respalda la base.** Las fotos viven en Supabase Storage y no están en el
dump. Decidir si se respaldan es parte de #251.

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

Un Postgres pelado no tiene las extensiones gestionadas de Supabase. En el
último ensayo, los únicos tres errores fueron de `supabase_vault`:

```
extension "supabase_vault" is not available
extension "supabase_vault" does not exist
relation "vault.secrets" does not exist
```

Eso no afecta al schema del dominio. El criterio es el recuento: si las tablas
de `public` traen las filas que tenía el origen y están las funciones, policies
y triggers, el dump sirve.

### Referencia de un restore verificado

Dump del harness de pgTAP (baseline + migraciones 030–052, sin datos), como
control del mecanismo:

| | |
|---|---|
| Tablas en `public` | 10 |
| Funciones | 33 |
| Policies | 27 |
| Triggers | 3 |
| Errores | 3, todos de `supabase_vault` |

Un backup de producción tiene el mismo schema y, además, filas. Si el recuento
de funciones o policies baja, el dump está incompleto.

## Restore de verdad, sobre un entorno

El ensayo prueba el dump. Poner esa base en un proyecto de Supabase es otra
cosa y **no** se hace con este script: va contra la URL del proyecto destino,
con los roles ya existentes, y conviene hacerlo sobre un proyecto vacío o
pausable antes que sobre uno en uso. Ese paso está abierto en #251.
