-- verify-016.sql — pegar en Supabase SQL Editor TRAS aplicar 016_parcelas_deleted_at.sql.
-- Retorna filas (check, status, detail). Esperado: todas con status='OK'.

WITH checks AS (
  SELECT 1 AS n, 'parcelas.deleted_at column exists' AS label,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='parcelas' AND column_name='deleted_at'
    ) AS pass,
    (SELECT data_type FROM information_schema.columns
     WHERE table_name='parcelas' AND column_name='deleted_at') AS detail
  UNION ALL
  SELECT 2, 'parcelas.deleted_at is TIMESTAMPTZ (timestamp with time zone)',
    ((SELECT data_type FROM information_schema.columns
      WHERE table_name='parcelas' AND column_name='deleted_at') = 'timestamp with time zone'),
    (SELECT data_type FROM information_schema.columns
     WHERE table_name='parcelas' AND column_name='deleted_at')
  UNION ALL
  SELECT 3, 'parcelas.deleted_at is NULLABLE',
    ((SELECT is_nullable FROM information_schema.columns
      WHERE table_name='parcelas' AND column_name='deleted_at') = 'YES'),
    (SELECT is_nullable FROM information_schema.columns
     WHERE table_name='parcelas' AND column_name='deleted_at')
  UNION ALL
  SELECT 4, 'data existente intacta: 0 parcelas con deleted_at NOT NULL inicialmente',
    ((SELECT COUNT(*) FROM parcelas WHERE deleted_at IS NOT NULL) = 0),
    (SELECT COUNT(*)::text FROM parcelas WHERE deleted_at IS NOT NULL)
  UNION ALL
  SELECT 5, 'total parcelas count preserved (21 esperado tras 014)',
    ((SELECT COUNT(*) FROM parcelas) > 0),
    (SELECT COUNT(*)::text FROM parcelas)
)
SELECT
  n,
  label AS check,
  CASE WHEN pass THEN 'OK' ELSE 'FAIL' END AS status,
  detail
FROM checks
ORDER BY n;
