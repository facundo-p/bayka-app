#!/usr/bin/env bash
# supabase/tests/lib.sh — funciones compartidas por run-db-tests.sh y
# regenerate-baseline.sh: detección del CLI, armado de un proyecto Supabase
# temporal (baseline + migraciones pendientes) y su cleanup. No se ejecuta
# solo: se hace `source`.

# CLI pinneado a la versión que resolvía `npx supabase@latest --version` al
# escribir esto (2026-09-04). CI usa supabase/setup-cli@v1 con el mismo pin
# (ver .github/workflows/db-tests.yml); local cae a npx si no hay `supabase`
# en el PATH. Bump manual cuando se quiera subir de versión.
SUPABASE_CLI_VERSION="2.116.0"

# detect_supabase_bin: setea el array global SUPABASE_BIN.
detect_supabase_bin() {
  if command -v supabase >/dev/null 2>&1; then
    SUPABASE_BIN=(supabase)
  else
    SUPABASE_BIN=(npx --yes "supabase@${SUPABASE_CLI_VERSION}")
  fi
  echo "==> CLI: ${SUPABASE_BIN[*]} (pin ${SUPABASE_CLI_VERSION})"
}

# make_tmp_project <supabase_dir> <tmp_root> <project_id> <port_prefix>
# Arma <tmp_root>/supabase/{config.toml,migrations/,tests/} a partir de
# <supabase_dir>: mismo config.toml con project_id y puertos propios
# (543XX -> <port_prefix>XX vía un único regex para port/shadow_port, p.ej.
# port_prefix "553" da 55321/55322/...) para no pisar un stack de desarrollo
# corriendo con supabase/config.toml, seeding de datos desactivado
# (supabase/seed.ts es un script de app contra un proyecto real, no un seed
# de esquema para pgTAP), baseline copiada como 00000000_baseline.sql
# (ordena primero por nombre de archivo sin importar el prefijo real) +
# supabase/migrations/*.sql, y los *.test.sql si el directorio los tiene.
make_tmp_project() {
  local supabase_dir="$1" tmp_root="$2" project_id="$3" port_prefix="$4"
  local tmp_supabase="$tmp_root/supabase"

  rm -rf "$tmp_root"
  mkdir -p "$tmp_supabase/migrations" "$tmp_supabase/tests"

  sed -E \
    -e "s/^project_id = .*/project_id = \"${project_id}\"/" \
    -e "s/^(shadow_)?port = 543([0-9]{2})\$/\1port = ${port_prefix}\2/" \
    -e '/^\[db.seed\]$/,/^enabled = true$/ s/^enabled = true$/enabled = false/' \
    "$supabase_dir/config.toml" > "$tmp_supabase/config.toml"

  cp "$supabase_dir/baseline_schema.sql" "$tmp_supabase/migrations/00000000_baseline.sql"
  shopt -s nullglob
  for f in "$supabase_dir"/migrations/*.sql; do
    cp "$f" "$tmp_supabase/migrations/$(basename "$f")"
  done
  shopt -u nullglob
  echo "==> Migraciones pendientes sobre la baseline:"
  ls "$tmp_supabase/migrations" | grep -v baseline || echo "(ninguna)"

  shopt -s nullglob
  local tests=("$supabase_dir"/tests/*.test.sql)
  shopt -u nullglob
  if [[ ${#tests[@]} -gt 0 ]]; then
    cp "${tests[@]}" "$tmp_supabase/tests/"
  fi
}

# stack_cleanup <tmp_root> [stop_on_exit]
# Pensada para `trap 'stack_cleanup "$TMP_ROOT" "$STOP_ON_EXIT"' EXIT`. Para
# el stack temporal salvo que stop_on_exit sea "0" (DB_TEST_KEEP_RUNNING=1).
stack_cleanup() {
  local tmp_root="$1" stop_on_exit="${2:-1}"
  if [[ "$stop_on_exit" == "1" ]]; then
    echo "==> Deteniendo stack temporal (--workdir $tmp_root)"
    "${SUPABASE_BIN[@]}" stop --workdir "$tmp_root" --no-backup >/dev/null 2>&1 || true
  else
    echo "==> DB_TEST_KEEP_RUNNING=1: dejo el stack corriendo en $tmp_root"
  fi
}
