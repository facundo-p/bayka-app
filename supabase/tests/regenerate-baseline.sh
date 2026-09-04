#!/usr/bin/env bash
# Regenera supabase/baseline_schema.sql a partir de un Postgres local
# (baseline actual + migraciones pendientes en supabase/migrations/), vía
# `supabase db dump --schema public` curado. Ver docs/db-baseline.md.
#
# Después de correr esto con éxito, las migraciones que acabás de fundir en
# la baseline se archivan a mano — solo las que ya estén aplicadas en prod
# (ver docs/db-baseline.md): `git mv supabase/migrations/0*.sql
# supabase/migrations/archive/` (quedate con migrations/data/ donde está).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SUPABASE_DIR="$REPO_ROOT/supabase"
TESTS_DIR="$SUPABASE_DIR/tests"
TMP_ROOT="$SUPABASE_DIR/.tmp-dbtest"

source "$SUPABASE_DIR/tests/lib.sh"
detect_supabase_bin

trap 'stack_cleanup "$TMP_ROOT" 1' EXIT

echo "==> 1. Levantando Postgres con la baseline actual + migraciones pendientes"
make_tmp_project "$SUPABASE_DIR" "$TMP_ROOT" "bayka-web-v1-rebaseline" "563"

# `db start` (solo Postgres) aplica baseline + migraciones directo sobre el
# volumen nuevo; `db dump` no necesita el resto del stack (kong/gotrue/...).
"${SUPABASE_BIN[@]}" db start --workdir "$TMP_ROOT"

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
-- levanta un Postgres local con la baseline actual + supabase/migrations/*.sql
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
echo "==> Revisá el diff, corré run-db-tests.sh, y si migraste algo nuevo a la baseline archivalo a mano (solo lo ya aplicado en prod)."
