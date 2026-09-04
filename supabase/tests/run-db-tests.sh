#!/usr/bin/env bash
# Harness pgTAP: arma un proyecto Supabase temporal (baseline + migraciones
# pendientes) y corre supabase test db contra un Postgres local descartable.
# Ver README.md en este mismo directorio.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SUPABASE_DIR="$REPO_ROOT/supabase"
TMP_ROOT="$SUPABASE_DIR/.tmp-dbtest"
PROJECT_ID="bayka-web-v1-dbtest"

source "$SUPABASE_DIR/tests/lib.sh"
detect_supabase_bin

STOP_ON_EXIT=1
if [[ "${DB_TEST_KEEP_RUNNING:-}" == "1" ]]; then
  STOP_ON_EXIT=0
fi
trap 'stack_cleanup "$TMP_ROOT" "$STOP_ON_EXIT"' EXIT

echo "==> Armando proyecto temporal en $TMP_ROOT"
make_tmp_project "$SUPABASE_DIR" "$TMP_ROOT" "$PROJECT_ID" "553"

# ── Reuso detectado: si queda un contenedor de una corrida anterior con
#    DB_TEST_KEEP_RUNNING=1, su volumen ya tiene la baseline+migraciones de
#    ESA corrida aplicadas — `db start` no las vuelve a aplicar sobre un
#    volumen existente. Un `db reset` fuerza el replay contra lo que
#    make_tmp_project acaba de armar. Sobre un volumen nuevo no hace falta:
#    `db start` ya aplica baseline + migraciones al crearlo.
REUSE_DETECTED=0
if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx "supabase_db_${PROJECT_ID}"; then
  REUSE_DETECTED=1
fi

echo "==> supabase db start (solo Postgres; test db/pgTAP no necesita el resto del stack)"
"${SUPABASE_BIN[@]}" db start --workdir "$TMP_ROOT"

if [[ "$REUSE_DETECTED" == "1" ]]; then
  echo "==> Volumen reusado de una corrida anterior: supabase db reset"
  "${SUPABASE_BIN[@]}" db reset --workdir "$TMP_ROOT" --local --no-seed
fi

echo "==> supabase test db"
"${SUPABASE_BIN[@]}" test db --workdir "$TMP_ROOT" --local

echo "==> OK"
