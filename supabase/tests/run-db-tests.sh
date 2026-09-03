#!/usr/bin/env bash
# Harness pgTAP: arma un proyecto Supabase temporal (baseline + migraciones
# pendientes) y corre supabase test db contra un stack local descartable. Ver
# README.md en este mismo directorio.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SUPABASE_DIR="$REPO_ROOT/supabase"
TMP_ROOT="$SUPABASE_DIR/.tmp-dbtest"
TMP_SUPABASE="$TMP_ROOT/supabase"
# CI instala el CLI real vía supabase/setup-cli@v1 (más rápido que bajarlo con
# npx en cada corrida); en una máquina sin esa instalación (no está en npm
# global, ver CLAUDE.md) cae a npx.
if command -v supabase >/dev/null 2>&1; then
  SUPABASE_BIN=(supabase)
else
  SUPABASE_BIN=(npx --yes supabase@latest)
fi

STOP_ON_EXIT=1
if [[ "${DB_TEST_KEEP_RUNNING:-}" == "1" ]]; then
  STOP_ON_EXIT=0
fi

cleanup() {
  if [[ "$STOP_ON_EXIT" == "1" ]]; then
    echo "==> Deteniendo stack temporal (--workdir $TMP_ROOT)"
    "${SUPABASE_BIN[@]}" stop --workdir "$TMP_ROOT" --no-backup >/dev/null 2>&1 || true
  else
    echo "==> DB_TEST_KEEP_RUNNING=1: dejo el stack corriendo en $TMP_ROOT"
  fi
}
trap cleanup EXIT

echo "==> Armando proyecto temporal en $TMP_ROOT"
rm -rf "$TMP_ROOT"
mkdir -p "$TMP_SUPABASE/migrations" "$TMP_SUPABASE/tests"

# ── config.toml: mismo proyecto, pero project_id y puertos propios para no
#    pisar un stack de desarrollo que ya esté corriendo con supabase/config.toml,
#    y seeding desactivado (supabase/seed.ts es un script de app contra un
#    proyecto real vía service_role, no un seed de esquema para pgTAP).
sed \
  -e 's/^project_id = .*/project_id = "bayka-web-v1-dbtest"/' \
  -e 's/^port = 54321$/port = 55321/' \
  -e 's/^port = 54322$/port = 55322/' \
  -e 's/^shadow_port = 54320$/shadow_port = 55320/' \
  -e 's/^port = 54323$/port = 55323/' \
  -e 's/^port = 54324$/port = 55324/' \
  -e 's/^port = 54327$/port = 55327/' \
  -e 's/^port = 54329$/port = 55329/' \
  -e '/^\[db.seed\]$/,/^enabled = true$/ s/^enabled = true$/enabled = false/' \
  "$SUPABASE_DIR/config.toml" > "$TMP_SUPABASE/config.toml"

# ── Migraciones: baseline (self-contained, incluye hasta 030 — #283) + lo que
#    haya en supabase/migrations/*.sql (solo migraciones nuevas, post-030; las
#    001-030 están archivadas en migrations/archive/, no se replayan). Prefijo
#    "00000000" para que ordene primero por nombre de archivo (string sort del
#    CLI) sin importar el prefijo numérico de las migraciones reales.
cp "$SUPABASE_DIR/baseline_schema.sql" "$TMP_SUPABASE/migrations/00000000_baseline.sql"
shopt -s nullglob
for f in "$SUPABASE_DIR"/migrations/*.sql; do
  cp "$f" "$TMP_SUPABASE/migrations/$(basename "$f")"
done
shopt -u nullglob
echo "==> Migraciones pendientes sobre la baseline:"
ls "$TMP_SUPABASE/migrations" | grep -v baseline || echo "(ninguna)"

# ── Tests pgTAP ────────────────────────────────────────────────────────────
cp "$SUPABASE_DIR"/tests/*.test.sql "$TMP_SUPABASE/tests/" 2>/dev/null || {
  echo "No hay *.test.sql en supabase/tests/" >&2
  exit 1
}

# ── Levantar stack, resetear con las migraciones armadas, correr pgTAP ──────
echo "==> supabase start"
"${SUPABASE_BIN[@]}" start --workdir "$TMP_ROOT"

echo "==> supabase db reset"
"${SUPABASE_BIN[@]}" db reset --workdir "$TMP_ROOT" --local --no-seed

echo "==> supabase test db"
"${SUPABASE_BIN[@]}" test db --workdir "$TMP_ROOT" --local

echo "==> OK"
