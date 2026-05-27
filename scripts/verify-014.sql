-- verify-014.sql — pegar en Supabase SQL Editor TRAS aplicar 014_data_consolidation.sql.
-- Retorna 10 filas con (check, status, detail). Esperado: todas con status='OK'.

-- Las 3 plantations nuevas son identificadas como "plantations que tienen
-- al menos una parcela" — solo las consolidadas tienen parcelas. Esto evita
-- el ambiguity con el source 67bfd338 que comparte lugar "San Sebastián de
-- la Selva" con la nueva consolidada (deferred cleanup junto con sources).
WITH new_plants AS (
  SELECT DISTINCT p.id, p.lugar FROM plantations p
  JOIN parcelas par ON par.plantation_id = p.id
),
sss_id AS (SELECT id FROM new_plants WHERE lugar = 'San Sebastián de la Selva'
           AND id IN (SELECT plantation_id FROM parcelas WHERE codigo LIKE 'LP%' OR codigo LIKE 'MP%')),
pss_id AS (SELECT id FROM new_plants WHERE lugar = 'Pruebas - SSS'),
pms_id AS (SELECT id FROM new_plants WHERE lugar = 'Pruebas - La Morita'),
checks AS (
  SELECT 1 AS n, '3 plantations nuevas existen' AS label,
    ((SELECT COUNT(*) FROM new_plants) = 3) AS pass,
    (SELECT COUNT(*)::text FROM new_plants) AS detail
  UNION ALL
  SELECT 2, '21 parcelas creadas',
    ((SELECT COUNT(*) FROM parcelas) = 21),
    (SELECT COUNT(*)::text FROM parcelas)
  UNION ALL
  SELECT 3, 'parcelas codes únicos esperados (LP1..LP13, MP1..MP4, SO, P3V, LM, Z1)',
    ((SELECT COUNT(DISTINCT codigo) FROM parcelas) = 21),
    (SELECT string_agg(codigo, ', ' ORDER BY codigo) FROM parcelas)
  UNION ALL
  SELECT 4, 'San Sebastián de la Selva: 17 parcelas, 233 groups, 7124 trees',
    ((SELECT COUNT(*) FROM parcelas WHERE plantation_id = (SELECT id FROM sss_id)) = 17
     AND (SELECT COUNT(*) FROM groups WHERE plantation_id = (SELECT id FROM sss_id)) = 233
     AND (SELECT COUNT(t.id) FROM trees t JOIN groups g ON g.id=t.group_id WHERE g.plantation_id = (SELECT id FROM sss_id)) = 7124),
    (SELECT COUNT(*)::text FROM parcelas WHERE plantation_id = (SELECT id FROM sss_id)) || 'p/' ||
    (SELECT COUNT(*)::text FROM groups WHERE plantation_id = (SELECT id FROM sss_id)) || 'g/' ||
    (SELECT COUNT(t.id)::text FROM trees t JOIN groups g ON g.id=t.group_id WHERE g.plantation_id = (SELECT id FROM sss_id)) || 't'
  UNION ALL
  SELECT 5, 'Pruebas - SSS: 2 parcelas, 5 groups, 114 trees',
    ((SELECT COUNT(*) FROM parcelas WHERE plantation_id = (SELECT id FROM pss_id)) = 2
     AND (SELECT COUNT(*) FROM groups WHERE plantation_id = (SELECT id FROM pss_id)) = 5
     AND (SELECT COUNT(t.id) FROM trees t JOIN groups g ON g.id=t.group_id WHERE g.plantation_id = (SELECT id FROM pss_id)) = 114),
    (SELECT COUNT(*)::text FROM parcelas WHERE plantation_id = (SELECT id FROM pss_id)) || 'p/' ||
    (SELECT COUNT(*)::text FROM groups WHERE plantation_id = (SELECT id FROM pss_id)) || 'g/' ||
    (SELECT COUNT(t.id)::text FROM trees t JOIN groups g ON g.id=t.group_id WHERE g.plantation_id = (SELECT id FROM pss_id)) || 't'
  UNION ALL
  SELECT 6, 'Pruebas - La Morita: 2 parcelas, 5 groups, 341 trees',
    ((SELECT COUNT(*) FROM parcelas WHERE plantation_id = (SELECT id FROM pms_id)) = 2
     AND (SELECT COUNT(*) FROM groups WHERE plantation_id = (SELECT id FROM pms_id)) = 5
     AND (SELECT COUNT(t.id) FROM trees t JOIN groups g ON g.id=t.group_id WHERE g.plantation_id = (SELECT id FROM pms_id)) = 341),
    (SELECT COUNT(*)::text FROM parcelas WHERE plantation_id = (SELECT id FROM pms_id)) || 'p/' ||
    (SELECT COUNT(*)::text FROM groups WHERE plantation_id = (SELECT id FROM pms_id)) || 'g/' ||
    (SELECT COUNT(t.id)::text FROM trees t JOIN groups g ON g.id=t.group_id WHERE g.plantation_id = (SELECT id FROM pms_id)) || 't'
  UNION ALL
  SELECT 7, 'sub_ids únicos dentro de cada plantación (no duplicates)',
    NOT EXISTS (
      SELECT 1 FROM (
        SELECT g.plantation_id, t.sub_id, COUNT(*) AS c
        FROM trees t JOIN groups g ON g.id = t.group_id
        WHERE g.plantation_id IN (SELECT id FROM new_plants)
        GROUP BY g.plantation_id, t.sub_id
        HAVING COUNT(*) > 1
      ) dups
    ),
    'unique check'
  UNION ALL
  SELECT 8, '0 trees con sub_id NULL/vacío en plantations nuevas',
    NOT EXISTS (
      SELECT 1 FROM trees t JOIN groups g ON g.id = t.group_id
      WHERE g.plantation_id IN (SELECT id FROM new_plants)
        AND (t.sub_id IS NULL OR trim(t.sub_id) = '')
    ),
    (SELECT COUNT(*)::text FROM trees t JOIN groups g ON g.id = t.group_id
     WHERE g.plantation_id IN (SELECT id FROM new_plants) AND (t.sub_id IS NULL OR trim(t.sub_id) = ''))
  UNION ALL
  SELECT 9, '0 groups con estado=sincronizada',
    NOT EXISTS (SELECT 1 FROM groups WHERE estado = 'sincronizada'),
    (SELECT COUNT(*)::text FROM groups WHERE estado = 'sincronizada')
  UNION ALL
  SELECT 10, '21 source plantations existen pero con 0 groups (listas para 015 delete)',
    ((SELECT COUNT(*) FROM plantations WHERE id IN (
       'cf13f308-c487-462f-8701-d21dd695c5e3'::uuid, 'b9226ac3-e89a-4269-9909-56a4e6897393'::uuid,
       '78a1e694-e7b5-41dc-b4ed-aa77a0576d45'::uuid, '3f545ecf-b0ef-419c-a0d8-211df6a1fa63'::uuid,
       'f48aa3c9-d8ee-4f2d-a69e-9abcd63081da'::uuid, 'eeafcc6e-d2ac-4775-a814-37aa32b3f0d5'::uuid,
       'ac0f42e8-18d0-4618-bc35-fbbfbec9c2db'::uuid, 'a51cca4c-ac04-44f3-ab51-7f3f21e68403'::uuid,
       '2fdac79f-7e51-4670-b0dd-dc06c80d6cf4'::uuid, '29fd1fde-b441-45c1-a6c7-be37a44ac939'::uuid,
       'b8469a0b-dc07-4de7-87c6-0dfb94661117'::uuid, 'abf7b739-5126-47ae-9973-eafc825c59f9'::uuid,
       '77b3410c-4ae8-4023-b6c6-089de586707f'::uuid, '3c542157-5a11-4a0a-aac9-369e93ba91ba'::uuid,
       '9343c880-f026-4252-ae82-6128962afab8'::uuid, '93495d6a-20eb-4e7a-88df-e7afa0a3a2b2'::uuid,
       'a0c1119f-6a11-47b5-8b56-9ece1716464d'::uuid, '67bfd338-f5be-46e9-8b7b-f440a2633873'::uuid,
       'be0eb2d5-f3ce-465d-8cc1-56651ef03b9a'::uuid, '5c064556-5a96-4657-b724-15e346ed1228'::uuid,
       '7ab85e48-f482-4fc1-9e07-586ec26751d9'::uuid
     )) = 21
     AND NOT EXISTS (
       SELECT 1 FROM groups WHERE plantation_id IN (
         'cf13f308-c487-462f-8701-d21dd695c5e3'::uuid, 'b9226ac3-e89a-4269-9909-56a4e6897393'::uuid,
         '78a1e694-e7b5-41dc-b4ed-aa77a0576d45'::uuid, '3f545ecf-b0ef-419c-a0d8-211df6a1fa63'::uuid,
         'f48aa3c9-d8ee-4f2d-a69e-9abcd63081da'::uuid, 'eeafcc6e-d2ac-4775-a814-37aa32b3f0d5'::uuid,
         'ac0f42e8-18d0-4618-bc35-fbbfbec9c2db'::uuid, 'a51cca4c-ac04-44f3-ab51-7f3f21e68403'::uuid,
         '2fdac79f-7e51-4670-b0dd-dc06c80d6cf4'::uuid, '29fd1fde-b441-45c1-a6c7-be37a44ac939'::uuid,
         'b8469a0b-dc07-4de7-87c6-0dfb94661117'::uuid, 'abf7b739-5126-47ae-9973-eafc825c59f9'::uuid,
         '77b3410c-4ae8-4023-b6c6-089de586707f'::uuid, '3c542157-5a11-4a0a-aac9-369e93ba91ba'::uuid,
         '9343c880-f026-4252-ae82-6128962afab8'::uuid, '93495d6a-20eb-4e7a-88df-e7afa0a3a2b2'::uuid,
         'a0c1119f-6a11-47b5-8b56-9ece1716464d'::uuid, '67bfd338-f5be-46e9-8b7b-f440a2633873'::uuid,
         'be0eb2d5-f3ce-465d-8cc1-56651ef03b9a'::uuid, '5c064556-5a96-4657-b724-15e346ed1228'::uuid,
         '7ab85e48-f482-4fc1-9e07-586ec26751d9'::uuid
       )
     )),
    'sources empty'
)
SELECT
  n,
  label AS check,
  CASE WHEN pass THEN 'OK' ELSE 'FAIL' END AS status,
  detail
FROM checks
ORDER BY n;
