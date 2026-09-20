#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Ensayo de restore de un backup de Supabase (#251).
#
# Levanta un Postgres efímero en Docker, restaura el dump ahí y cuenta lo que
# quedó. No toca prod ni staging: un backup que solo se puede probar contra una
# base real no se prueba nunca.
#
# Los clientes (pg_restore, psql) salen de la imagen, no de la laptop: el dump
# lo genera pg_dump 17 en CI y un cliente más viejo se niega a leerlo.
#
#   scripts/restore-backup.sh backup-20260919-050000.dump
#   scripts/restore-backup.sh --conservar backup.dump   # deja el contenedor vivo
# ==============================================================================

IMAGEN="${IMAGEN_RESTORE:-postgres:17-alpine}"
CONSERVAR=false
if [[ "${1:-}" == "--conservar" ]]; then
  CONSERVAR=true
  shift
fi

DUMP="${1:-}"
if [[ -z "$DUMP" || ! -f "$DUMP" ]]; then
  echo "Uso: scripts/restore-backup.sh [--conservar] <archivo.dump>" >&2
  echo "El dump lo genera scripts/supabase-backup.sh (pg_dump --format=custom)." >&2
  exit 1
fi

command -v docker >/dev/null || { echo "ERROR: falta docker" >&2; exit 1; }

CONTENEDOR="bayka-restore-$$"
LOG="/tmp/${CONTENEDOR}.log"

limpiar() {
  if [[ "$CONSERVAR" == true ]]; then
    echo ""
    echo "Contenedor vivo: docker exec -it ${CONTENEDOR} psql -U postgres"
    echo "Para borrarlo:   docker rm -f ${CONTENEDOR}"
  else
    docker rm -f "$CONTENEDOR" >/dev/null 2>&1 || true
  fi
}
trap limpiar EXIT

en_psql() { docker exec -i "$CONTENEDOR" psql -U postgres -d postgres "$@"; }

echo "==> Postgres efímero (${IMAGEN}, contenedor ${CONTENEDOR})"
docker run -d --name "$CONTENEDOR" -e POSTGRES_PASSWORD=ensayo "$IMAGEN" >/dev/null

echo -n "    esperando"
for _ in $(seq 1 60); do
  if docker exec "$CONTENEDOR" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  echo -n "."
  sleep 1
done
echo ""
docker exec "$CONTENEDOR" pg_isready -U postgres >/dev/null

# Un Postgres pelado no tiene los roles de Supabase, y el dump les hace GRANT.
# Crearlos es parte del procedimiento de restore, no un atajo del ensayo.
echo "==> Creando los roles de Supabase que el dump espera"
en_psql -v ON_ERROR_STOP=1 -q <<'SQL'
do $$
declare rol text;
begin
  foreach rol in array array[
    'anon', 'authenticated', 'service_role', 'authenticator',
    'supabase_admin', 'supabase_auth_admin', 'supabase_storage_admin',
    'dashboard_user', 'pgbouncer'
  ] loop
    if not exists (select 1 from pg_roles where rolname = rol) then
      execute format('create role %I', rol);
    end if;
  end loop;
end $$;
SQL

echo "==> Restaurando ${DUMP}"
# Los errores no frenan el restore: un dump de Supabase trae objetos de
# extensiones y de schemas gestionados que un Postgres pelado no tiene. Lo que
# importa es que `public` quede entero, y eso lo mide el recuento de abajo.
docker exec -i "$CONTENEDOR" pg_restore --no-owner --no-acl -U postgres -d postgres \
  < "$DUMP" 2>"$LOG" || true
ERRORES=$(grep -c '^pg_restore: error' "$LOG" || true)

echo "==> Lo que quedó en la base restaurada"
en_psql -q <<'SQL'
\pset border 2
select table_name as tabla,
       (xpath('/row/c/text()',
              query_to_xml(format('select count(*) as c from public.%I', table_name),
                           false, true, '')))[1]::text::int as filas
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by 1;

select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public') as funciones,
  (select count(*) from pg_policies where schemaname = 'public') as policies,
  (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and not t.tgisinternal) as triggers;
SQL

echo ""
echo "=============================="
echo "  Ensayo de restore"
echo "=============================="
echo "  Dump          : ${DUMP}"
echo "  Errores       : ${ERRORES} (detalle en ${LOG})"
echo "=============================="
echo ""
echo "El restore sirve si las tablas del dominio traen las filas esperadas y"
echo "están las funciones, policies y triggers. Comparar contra la base de"
echo "origen; los errores de objetos de extensiones son esperables acá."
