#!/usr/bin/env bash
# Harness pgTAP: arma un proyecto Supabase temporal (baseline + deltas) y corre
# supabase test db contra un stack local descartable. Ver README.md en este
# mismo directorio para el detalle del porqué (#283, #308).
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

# ── 1. baseline_schema.sql como primera migración ────────────────────────────
# pg_dump artefactos que no aplican fuera de un restore controlado (detalle y
# motivo de cada filtro en README.md):
#   - "SELECT pg_catalog.set_config('search_path', '', false);" seguido de
#     "SET row_security = off;": rompen la creación de objetos que dependen de
#     resolución de schema (extensions.*) durante la migración. Se quitan.
#   - CREATE EXTENSION ... WITH SCHEMA "vault": supabase_vault ya viene
#     preinstalada por la imagen local en el schema vault; recrearla via
#     migración choca con objetos existentes. Se quita esa línea puntual.
#   - Faltan los triggers de auth.users (trg_handle_new_user, trg_sync_profile_email,
#     migración 026): baseline_schema.sql es un dump de schema "public" únicamente,
#     y esos triggers cuelgan de auth.users, fuera de ese schema. Sin ellos, insertar
#     en auth.users no auto-crea la fila en profiles y cualquier fixture de test que
#     dependa de ese auto-provisioning (todas: profiles es requisito de plantation_users,
#     groups, trees) rompe por FK. Se agregan al final de la migración armada,
#     apuntando a las funciones handle_new_user()/sync_profile_email() que sí
#     trae la baseline (definidas ahí, solo les faltaba el trigger que las cuelga).
sed \
  -e "/SELECT pg_catalog.set_config('search_path', '', false);/d" \
  -e '/^SET row_security = off;$/d' \
  -e '/CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";/d' \
  "$SUPABASE_DIR/baseline_schema.sql" > "$TMP_SUPABASE/migrations/20260101000000_baseline.sql"

cat >> "$TMP_SUPABASE/migrations/20260101000000_baseline.sql" <<'SQL'

-- ── Fixup del harness: triggers de auth.users que el dump de schema "public"
-- no puede incluir (ver comentario arriba, en run-db-tests.sh). Cuerpo idéntico
-- a la migración 026.
CREATE OR REPLACE TRIGGER "trg_handle_new_user"
  AFTER INSERT ON "auth"."users"
  FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();

CREATE OR REPLACE TRIGGER "trg_sync_profile_email"
  AFTER UPDATE OF "email" ON "auth"."users"
  FOR EACH ROW
  WHEN (NEW.email IS DISTINCT FROM OLD.email)
  EXECUTE FUNCTION "public"."sync_profile_email"();
SQL

# ── 2. Migraciones posteriores a 029 (la baseline ya incluye hasta 029) ──────
# El CLI ordena migraciones por nombre de archivo completo (string sort), no
# numéricamente: "030_..." < "20260101000000_baseline.sql" porque '0' < '2'.
# Se re-prefijan con timestamps posteriores al de la baseline, preservando el
# nombre original y el orden relativo (numérico, vía sort -n sobre el prefijo).
delta_idx=0
for f in $(for g in "$SUPABASE_DIR"/migrations/*.sql; do
  base="$(basename "$g")"
  num="${base%%_*}"
  [[ "$num" =~ ^[0-9]+$ ]] && (( 10#$num > 29 )) && echo "$((10#$num)) $g"
done | sort -n | cut -d' ' -f2-); do
  delta_idx=$((delta_idx + 1))
  base="$(basename "$f")"
  new_prefix="$(printf '2026010100%04d' "$delta_idx")"
  cp "$f" "$TMP_SUPABASE/migrations/${new_prefix}_${base}"
done
echo "==> Migraciones delta incluidas (>029):"
ls "$TMP_SUPABASE/migrations" | grep -v baseline

# ── 3. Tests pgTAP ────────────────────────────────────────────────────────────
cp "$SUPABASE_DIR"/tests/*.test.sql "$TMP_SUPABASE/tests/" 2>/dev/null || {
  echo "No hay *.test.sql en supabase/tests/" >&2
  exit 1
}

# ── 4. Levantar stack, resetear con las migraciones armadas, correr pgTAP ────
echo "==> supabase start"
"${SUPABASE_BIN[@]}" start --workdir "$TMP_ROOT"

echo "==> supabase db reset"
"${SUPABASE_BIN[@]}" db reset --workdir "$TMP_ROOT" --local --no-seed

echo "==> supabase test db"
"${SUPABASE_BIN[@]}" test db --workdir "$TMP_ROOT" --local

echo "==> OK"
