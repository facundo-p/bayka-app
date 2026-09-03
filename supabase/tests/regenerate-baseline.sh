#!/usr/bin/env bash
# Regenera supabase/baseline_schema.sql a partir del stack local (baseline
# actual + migraciones pendientes en supabase/migrations/), vía
# `supabase db dump --schema public` curado. Ver docs/db-baseline.md.
#
# Después de correr esto con éxito, las migraciones que acabás de fundir en
# la baseline se archivan a mano: `git mv supabase/migrations/0*.sql
# supabase/migrations/archive/` (quedate con migrations/data/ donde está).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SUPABASE_DIR="$REPO_ROOT/supabase"
TESTS_DIR="$SUPABASE_DIR/tests"
TMP_ROOT="$SUPABASE_DIR/.tmp-dbtest"
TMP_SUPABASE="$TMP_ROOT/supabase"

if command -v supabase >/dev/null 2>&1; then
  SUPABASE_BIN=(supabase)
else
  SUPABASE_BIN=(npx --yes supabase@latest)
fi

cleanup() {
  echo "==> Deteniendo stack temporal (--workdir $TMP_ROOT)"
  "${SUPABASE_BIN[@]}" stop --workdir "$TMP_ROOT" --no-backup >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> 1. Levantando stack con la baseline actual + migraciones pendientes"
rm -rf "$TMP_ROOT"
mkdir -p "$TMP_SUPABASE/migrations"
sed \
  -e 's/^project_id = .*/project_id = "bayka-web-v1-rebaseline"/' \
  -e 's/^port = 54321$/port = 56321/' \
  -e 's/^port = 54322$/port = 56322/' \
  -e 's/^shadow_port = 54320$/shadow_port = 56320/' \
  -e 's/^port = 54323$/port = 56323/' \
  -e 's/^port = 54324$/port = 56324/' \
  -e 's/^port = 54327$/port = 56327/' \
  -e 's/^port = 54329$/port = 56329/' \
  -e '/^\[db.seed\]$/,/^enabled = true$/ s/^enabled = true$/enabled = false/' \
  "$SUPABASE_DIR/config.toml" > "$TMP_SUPABASE/config.toml"
cp "$SUPABASE_DIR/baseline_schema.sql" "$TMP_SUPABASE/migrations/00000000_baseline.sql"
shopt -s nullglob
for f in "$SUPABASE_DIR"/migrations/*.sql; do
  cp "$f" "$TMP_SUPABASE/migrations/$(basename "$f")"
done
shopt -u nullglob

"${SUPABASE_BIN[@]}" start --workdir "$TMP_ROOT"
"${SUPABASE_BIN[@]}" db reset --workdir "$TMP_ROOT" --local --no-seed

echo "==> 2. supabase db dump --schema public"
RAW_DUMP="$TMP_ROOT/dump.sql"
"${SUPABASE_BIN[@]}" db dump --workdir "$TMP_ROOT" --local --schema public -f "$RAW_DUMP"

echo "==> 3. Curando: filtros + baseline-extras.sql + header"
CURATED="$TMP_ROOT/baseline_schema.sql"

cat > "$CURATED" <<'HEADER'
-- supabase/baseline_schema.sql — snapshot completo del schema "public",
-- equivalente a staging/prod luego de aplicar todas las migraciones vigentes
-- a la fecha de esta regeneración (issue #283).
--
-- Se regenera con este mismo script (supabase/tests/regenerate-baseline.sh):
-- levanta el stack local con la baseline actual + supabase/migrations/*.sql
-- pendientes, corre `supabase db dump --schema public` (ya emite
-- CREATE TABLE/FUNCTION/TRIGGER/VIEW con IF NOT EXISTS / OR REPLACE, así que
-- el resultado es idempotente tal cual) y le aplica dos filtros más el
-- agregado de supabase/tests/baseline-extras.sql. Ver docs/db-baseline.md.
--
-- Filtros aplicados al dump (no aplican fuera de un pg_restore controlado):
--   - SELECT pg_catalog.set_config('search_path', '', false);
--   - SET row_security = off;
HEADER

sed \
  -e "/SELECT pg_catalog.set_config('search_path', '', false);/d" \
  -e '/^SET row_security = off;$/d' \
  "$RAW_DUMP" >> "$CURATED"

cat "$TESTS_DIR/baseline-extras.sql" >> "$CURATED"

cp "$CURATED" "$SUPABASE_DIR/baseline_schema.sql"
echo "==> supabase/baseline_schema.sql regenerado ($(wc -l < "$SUPABASE_DIR/baseline_schema.sql") líneas)."
echo "==> Revisá el diff, corré run-db-tests.sh, y si migraste algo nuevo a la baseline archivalo a mano."
