-- verify-013.sql — pegar en Supabase SQL Editor TRAS aplicar 013_cleanup_test_plantations.sql.
-- Retorna 4 filas con (check, status, detail). Esperado: todas con status='OK'.

WITH checks AS (
  SELECT 1 AS n, 'total plantations = 21' AS label,
    ((SELECT COUNT(*) FROM plantations) = 21) AS pass,
    (SELECT COUNT(*)::text FROM plantations) AS detail
  UNION ALL
  SELECT 2, 'none of the 11 test plantations exist',
    NOT EXISTS (
      SELECT 1 FROM plantations
      WHERE id IN (
        '00000000-0000-0000-0000-000000000002'::uuid,
        'e072775e-074b-457a-9739-e04838978316'::uuid,
        '80b85acd-e58b-44cf-9169-a3f25741e114'::uuid,
        '26e190db-d453-42b4-96bf-16a1969fc1ae'::uuid,
        '747981d3-78d3-46db-9414-ae6ad8a83f62'::uuid,
        '0eea0006-b98f-4ae8-a55e-eb58ceb4824b'::uuid,
        'a536bd66-1d7b-41be-9b96-2303cfdc0514'::uuid,
        '09a315e2-0754-410b-81da-d3ff862cd8bb'::uuid,
        '203beee5-981f-4029-9cc5-9403d14ae0a5'::uuid,
        '6d2e80b0-7ede-4d24-a50a-210060c4465a'::uuid,
        '7fea8850-ec03-4be9-86dc-0a4efc5ae7f0'::uuid
      )
    ),
    'cascade ok'
  UNION ALL
  SELECT 3, 'no orphan groups (every group has a plantation)',
    NOT EXISTS (
      SELECT 1 FROM groups g
      LEFT JOIN plantations p ON p.id = g.plantation_id
      WHERE p.id IS NULL
    ),
    (SELECT COUNT(*)::text FROM groups g LEFT JOIN plantations p ON p.id = g.plantation_id WHERE p.id IS NULL)
  UNION ALL
  SELECT 4, 'no orphan trees (every tree has a group)',
    NOT EXISTS (
      SELECT 1 FROM trees t
      LEFT JOIN groups g ON g.id = t.group_id
      WHERE g.id IS NULL
    ),
    (SELECT COUNT(*)::text FROM trees t LEFT JOIN groups g ON g.id = t.group_id WHERE g.id IS NULL)
)
SELECT
  n,
  label AS check,
  CASE WHEN pass THEN 'OK' ELSE 'FAIL' END AS status,
  detail
FROM checks
ORDER BY n;
