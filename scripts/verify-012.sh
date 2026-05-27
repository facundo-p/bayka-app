#!/usr/bin/env bash
# verify-012.sh — verifica que migration 012_parcelas_and_rename.sql se aplicó correctamente.
# Requiere DATABASE_URL exportado (Supabase Postgres connection string).
# Uso: DATABASE_URL=postgres://... ./scripts/verify-012.sh

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL no definido. Exportarlo desde Supabase dashboard."
  echo "Alternativa: pegar scripts/verify-012.sql en el SQL Editor del dashboard."
  exit 1
fi

run_check() {
  local label="$1"
  local sql="$2"
  local expected="$3"
  local actual
  actual=$(psql "$DATABASE_URL" -t -A -c "$sql" 2>&1 | tr -d '[:space:]')
  if [[ "$actual" == "$expected" ]]; then
    echo "OK    | $label (got: $actual)"
  else
    echo "FAIL  | $label (expected: $expected, got: $actual)"
    exit 1
  fi
}

echo "== Verificando migration 012 contra Supabase =="

# 1. Tabla parcelas existe
run_check "parcelas table exists" \
  "SELECT to_regclass('public.parcelas')::text;" \
  "parcelas"

# 2. Tabla groups existe (rename de subgroups)
run_check "groups table exists" \
  "SELECT to_regclass('public.groups')::text;" \
  "groups"

# 3. Tabla subgroups NO existe
run_check "subgroups table dropped" \
  "SELECT COALESCE(to_regclass('public.subgroups')::text, 'NULL');" \
  "NULL"

# 4. groups.parcela_id columna existe
run_check "groups.parcela_id column exists" \
  "SELECT column_name FROM information_schema.columns WHERE table_name='groups' AND column_name='parcela_id';" \
  "parcela_id"

# 5. trees.group_id columna existe (renombrada)
run_check "trees.group_id column exists" \
  "SELECT column_name FROM information_schema.columns WHERE table_name='trees' AND column_name='group_id';" \
  "group_id"

# 6. trees.subgroup_id columna NO existe
run_check "trees.subgroup_id column removed" \
  "SELECT COUNT(*)::text FROM information_schema.columns WHERE table_name='trees' AND column_name='subgroup_id';" \
  "0"

# 7. Unique index per-parcela existe
run_check "groups_parcela_codigo_unique exists" \
  "SELECT indexname FROM pg_indexes WHERE tablename='groups' AND indexname='groups_parcela_codigo_unique';" \
  "groups_parcela_codigo_unique"

# 8. CHECK descripcion <= 10000
run_check "parcelas descripcion CHECK exists" \
  "SELECT conname FROM pg_constraint WHERE conrelid='parcelas'::regclass AND conname='parcelas_descripcion_length';" \
  "parcelas_descripcion_length"

# 9. tipo CHECK acepta bosquete
run_check "groups tipo CHECK includes bosquete" \
  "SELECT (pg_get_constraintdef(oid) LIKE '%bosquete%')::text FROM pg_constraint WHERE conname='groups_tipo_check';" \
  "true"

# 10. RLS habilitada en parcelas
run_check "parcelas RLS enabled" \
  "SELECT relrowsecurity::text FROM pg_class WHERE relname='parcelas';" \
  "t"

# 11. RPC sync_subgroup referencia 'groups' (no 'subgroups')
run_check "sync_subgroup RPC body uses groups" \
  "SELECT (pg_get_functiondef(p.oid) LIKE '%FROM groups%' AND pg_get_functiondef(p.oid) NOT LIKE '%FROM subgroups%')::text FROM pg_proc p WHERE p.proname='sync_subgroup';" \
  "true"

# 12. Policy update trees usa group_id
run_check "trees UPDATE policy uses group_id" \
  "SELECT (qual::text LIKE '%group_id%' AND qual::text NOT LIKE '%subgroup_id%')::text FROM pg_policies WHERE tablename='trees' AND cmd='UPDATE' AND policyname='Plantation members can update trees';" \
  "true"

echo ""
echo "== Todas las verificaciones de 012 pasaron =="
