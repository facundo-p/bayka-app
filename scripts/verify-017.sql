-- verify-017.sql — pegar tras aplicar 017_parcelas_partial_unique_indexes.sql.
-- Confirma que los indexes existen como PARTIAL (con WHERE deleted_at IS NULL).

WITH checks AS (
  SELECT 1 AS n, 'parcelas_plantation_code_unique exists' AS label,
    EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname='public' AND tablename='parcelas'
        AND indexname='parcelas_plantation_code_unique'
    ) AS pass,
    (SELECT indexdef FROM pg_indexes WHERE indexname='parcelas_plantation_code_unique') AS detail
  UNION ALL
  SELECT 2, 'parcelas_plantation_name_unique exists',
    EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname='public' AND tablename='parcelas'
        AND indexname='parcelas_plantation_name_unique'
    ),
    (SELECT indexdef FROM pg_indexes WHERE indexname='parcelas_plantation_name_unique')
  UNION ALL
  SELECT 3, 'code index is PARTIAL (contiene WHERE deleted_at IS NULL)',
    EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE indexname='parcelas_plantation_code_unique'
        AND indexdef LIKE '%WHERE (deleted_at IS NULL)%'
    ),
    'partial check'
  UNION ALL
  SELECT 4, 'name index is PARTIAL (contiene WHERE deleted_at IS NULL)',
    EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE indexname='parcelas_plantation_name_unique'
        AND indexdef LIKE '%WHERE (deleted_at IS NULL)%'
    ),
    'partial check'
  UNION ALL
  SELECT 5, 'old UNIQUE CONSTRAINTS dropped (no quedan dos con mismo nombre)',
    NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name='parcelas'
        AND constraint_type='UNIQUE'
        AND constraint_name IN ('parcelas_plantation_code_unique','parcelas_plantation_name_unique')
    ),
    'constraint cleanup'
)
SELECT
  n,
  label AS check,
  CASE WHEN pass THEN 'OK' ELSE 'FAIL' END AS status,
  detail
FROM checks
ORDER BY n;
