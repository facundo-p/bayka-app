-- verify-012.sql — pegar en Supabase SQL Editor TRAS aplicar 012_parcelas_and_rename.sql.
-- Retorna 1 fila por chequeo con columnas (check, status, detail).
-- Espera 12 filas, TODAS con status='OK'. Si alguna dice 'FAIL', algo salió mal.

WITH checks AS (
  SELECT 1 AS n, 'parcelas table exists' AS label,
    (to_regclass('public.parcelas') IS NOT NULL) AS pass,
    COALESCE(to_regclass('public.parcelas')::text, 'NULL') AS detail
  UNION ALL
  SELECT 2, 'groups table exists',
    (to_regclass('public.groups') IS NOT NULL),
    COALESCE(to_regclass('public.groups')::text, 'NULL')
  UNION ALL
  SELECT 3, 'subgroups table dropped',
    (to_regclass('public.subgroups') IS NULL),
    COALESCE(to_regclass('public.subgroups')::text, 'NULL')
  UNION ALL
  SELECT 4, 'groups.parcela_id column exists',
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_name='groups' AND column_name='parcela_id'),
    (SELECT data_type FROM information_schema.columns
     WHERE table_name='groups' AND column_name='parcela_id')
  UNION ALL
  SELECT 5, 'trees.group_id column exists',
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_name='trees' AND column_name='group_id'),
    (SELECT data_type FROM information_schema.columns
     WHERE table_name='trees' AND column_name='group_id')
  UNION ALL
  SELECT 6, 'trees.subgroup_id column removed',
    NOT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name='trees' AND column_name='subgroup_id'),
    'removed'
  UNION ALL
  SELECT 7, 'groups_parcela_codigo_unique exists',
    EXISTS (SELECT 1 FROM pg_indexes
            WHERE tablename='groups' AND indexname='groups_parcela_codigo_unique'),
    'index'
  UNION ALL
  SELECT 8, 'parcelas descripcion CHECK exists',
    EXISTS (SELECT 1 FROM pg_constraint
            WHERE conrelid='parcelas'::regclass AND conname='parcelas_descripcion_length'),
    'constraint'
  UNION ALL
  SELECT 9, 'groups tipo CHECK includes bosquete',
    EXISTS (SELECT 1 FROM pg_constraint
            WHERE conname='groups_tipo_check'
              AND pg_get_constraintdef(oid) LIKE '%bosquete%'),
    (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='groups_tipo_check')
  UNION ALL
  SELECT 10, 'parcelas RLS enabled',
    (SELECT relrowsecurity FROM pg_class WHERE relname='parcelas'),
    'rls'
  UNION ALL
  SELECT 11, 'sync_subgroup RPC body uses groups (not subgroups)',
    EXISTS (SELECT 1 FROM pg_proc p WHERE p.proname='sync_subgroup'
              AND pg_get_functiondef(p.oid) LIKE '%FROM groups%'
              AND pg_get_functiondef(p.oid) NOT LIKE '%FROM subgroups%'),
    'rpc'
  UNION ALL
  SELECT 12, 'trees UPDATE policy uses group_id',
    EXISTS (SELECT 1 FROM pg_policies
            WHERE tablename='trees' AND cmd='UPDATE'
              AND policyname='Plantation members can update trees'
              AND qual::text LIKE '%group_id%'
              AND qual::text NOT LIKE '%subgroup_id%'),
    'policy'
)
SELECT
  n,
  label AS check,
  CASE WHEN pass THEN 'OK' ELSE 'FAIL' END AS status,
  detail
FROM checks
ORDER BY n;
