-- verify-012c.sql — pegar en Supabase SQL Editor TRAS aplicar 012c_rename_pp_to_medio_p4.sql.
-- Retorna 4 filas con (check, status, detail). Esperado: todas con status='OK'.

WITH checks AS (
  SELECT 1 AS n, 'new SSS-Medio-P4 has UUID a0c1119f (ex-Pp)' AS label,
    EXISTS (SELECT 1 FROM plantations
            WHERE id = 'a0c1119f-6a11-47b5-8b56-9ece1716464d'::uuid
              AND lugar = 'SSS-Medio-P4'
              AND periodo = 'Otoño 2026') AS pass,
    (SELECT lugar || ' | ' || periodo FROM plantations
     WHERE id = 'a0c1119f-6a11-47b5-8b56-9ece1716464d'::uuid) AS detail
  UNION ALL
  SELECT 2, 'old SSS-Medio-P4 (51fea9e5) renamed to -deprecated',
    EXISTS (SELECT 1 FROM plantations
            WHERE id = '51fea9e5-2537-4cef-82fd-c07d6375dbf0'::uuid
              AND lugar = 'SSS-Medio-P4-deprecated'),
    (SELECT lugar FROM plantations
     WHERE id = '51fea9e5-2537-4cef-82fd-c07d6375dbf0'::uuid)
  UNION ALL
  SELECT 3, 'no other plantation named "Pp" exists',
    NOT EXISTS (SELECT 1 FROM plantations WHERE lugar = 'Pp'),
    'none'
  UNION ALL
  SELECT 4, 'new SSS-Medio-P4 tree count matches Pp sync (920)',
    ((SELECT COUNT(t.id) FROM trees t JOIN groups g ON g.id = t.group_id
      WHERE g.plantation_id = 'a0c1119f-6a11-47b5-8b56-9ece1716464d'::uuid) = 920),
    (SELECT COUNT(t.id)::text FROM trees t JOIN groups g ON g.id = t.group_id
     WHERE g.plantation_id = 'a0c1119f-6a11-47b5-8b56-9ece1716464d'::uuid)
)
SELECT
  n,
  label AS check,
  CASE WHEN pass THEN 'OK' ELSE 'FAIL' END AS status,
  detail
FROM checks
ORDER BY n;
