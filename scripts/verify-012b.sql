-- verify-012b.sql — pegar en Supabase SQL Editor TRAS aplicar 012b_old_client_compat_shim.sql.
-- Retorna 5 filas con (check, status, detail). Esperado: todas con status='OK'.

WITH checks AS (
  SELECT 1 AS n, 'view subgroups exists' AS label,
    EXISTS (SELECT 1 FROM information_schema.views WHERE table_name='subgroups') AS pass,
    'view'::text AS detail
  UNION ALL
  SELECT 2, 'view subgroups returns same row count as groups',
    ((SELECT COUNT(*) FROM subgroups) = (SELECT COUNT(*) FROM groups)),
    (SELECT COUNT(*)::text FROM subgroups) || ' vs ' || (SELECT COUNT(*)::text FROM groups)
  UNION ALL
  SELECT 3, 'trees.subgroup_id generated column exists',
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='trees' AND column_name='subgroup_id'
        AND is_generated = 'ALWAYS'
    ),
    (SELECT generation_expression FROM information_schema.columns
     WHERE table_name='trees' AND column_name='subgroup_id')
  UNION ALL
  SELECT 4, 'trees.subgroup_id values match group_id for all rows',
    NOT EXISTS (SELECT 1 FROM trees WHERE subgroup_id IS DISTINCT FROM group_id),
    (SELECT COUNT(*)::text FROM trees WHERE subgroup_id IS DISTINCT FROM group_id) || ' mismatches'
  UNION ALL
  SELECT 5, 'sync_subgroup RPC body uses COALESCE for group_id/subgroup_id',
    EXISTS (
      SELECT 1 FROM pg_proc p
      WHERE p.proname='sync_subgroup'
        AND pg_get_functiondef(p.oid) LIKE '%COALESCE%group_id%subgroup_id%'
    ),
    'rpc body'::text
)
SELECT
  n,
  label AS check,
  CASE WHEN pass THEN 'OK' ELSE 'FAIL' END AS status,
  detail
FROM checks
ORDER BY n;
