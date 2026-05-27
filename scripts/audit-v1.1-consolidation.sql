-- ============================================================================
-- Audit query: Phase 15 v1.1 consolidation — pre-migration count verification
-- ============================================================================
-- Run against Supabase production BEFORE writing 013_data_consolidation.sql.
-- Output is the source of truth for:
--   - Mapping plantation.id → target Parcela (Loma-P1..P13, Medio-P1..P4, etc.)
--   - Re-confirming the ~6.776 tree count vs the ~7000 figure from earlier analysis
--   - Validating MIGR-04..07 cluster assignments
--   - Detecting edge cases (orphan groups, NULL codes, unexpected estado)
--
-- Required outputs (paste into supabase/migrations/data/015_consolidation_mapping.md):
--   1. Per-plantation breakdown — for the mapping table
--   2. Per-cluster totals — to validate MIGR-04..06 expected counts
--   3. Plantations to delete — verify MIGR-07 (44 groups / 433 trees)
--   4. Sincronizada count — verify MIGR-08 (269 groups)
--   5. Edge case scans — orphan rows, NULL codes, unexpected types
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Per-plantation breakdown (intended for the mapping table)
-- ---------------------------------------------------------------------------
SELECT
  p.id,
  p.lugar,
  p.periodo,
  p.estado,
  COUNT(DISTINCT s.id) AS groups_count,
  COUNT(t.id)          AS trees_count
FROM plantations p
LEFT JOIN subgroups s ON s.plantacion_id = p.id
LEFT JOIN trees     t ON t.subgrupo_id   = s.id
GROUP BY p.id, p.lugar, p.periodo, p.estado
ORDER BY p.lugar, p.periodo, p.id;

-- ---------------------------------------------------------------------------
-- 2. Cluster totals — assigned by lugar pattern (adjust patterns if needed)
-- Expected per ROADMAP / REQUIREMENTS:
--   Cluster A (SSS) → 215 groups, 6.321 trees, 17 source plantations
--   Cluster B (Pruebas - SSS) → 5 groups, 114 trees, 2 source plantations
--   Cluster C (Pruebas - La Morita) → 5 groups, 341 trees, 2 source plantations
-- ---------------------------------------------------------------------------
WITH classified AS (
  SELECT
    p.id,
    p.lugar,
    p.periodo,
    CASE
      WHEN p.id IN (
        '00000000-0000-0000-0000-000000000000',  -- La Maluka (verify full UUIDs against REQUIREMENTS MIGR-07)
        'e072775e', '80b85acd', '26e190db', '747981d3',
        '0eea0006', 'a536bd66', '09a315e2', '203beee5',
        '6d2e80b0', '7fea8850'
      ) THEN 'TO_DELETE'
      WHEN p.lugar ILIKE '%sss%loma%' OR p.lugar ILIKE '%sss%medio%' OR p.lugar ILIKE '%san sebast%' THEN 'CLUSTER_A_SSS'
      WHEN p.lugar ILIKE '%selva original%' OR p.lugar ILIKE '%p3 vieja%' THEN 'CLUSTER_B_PRUEBAS_SSS'
      WHEN p.lugar ILIKE '%la morita%' OR p.lugar ILIKE '%zona 1%' THEN 'CLUSTER_C_PRUEBAS_LM'
      ELSE 'UNCLASSIFIED'
    END AS cluster,
    s.id  AS group_id,
    t.id  AS tree_id
  FROM plantations p
  LEFT JOIN subgroups s ON s.plantacion_id = p.id
  LEFT JOIN trees     t ON t.subgrupo_id   = s.id
)
SELECT
  cluster,
  COUNT(DISTINCT id)        AS plantations,
  COUNT(DISTINCT group_id)  AS groups,
  COUNT(tree_id)            AS trees
FROM classified
GROUP BY cluster
ORDER BY cluster;

-- ---------------------------------------------------------------------------
-- 3. Plantations to delete — verify MIGR-07 totals (44 groups / 433 trees)
-- NOTE: Replace the partial UUIDs from REQUIREMENTS.md with their full form
-- before running. The IDs there are 8-char prefixes only.
-- ---------------------------------------------------------------------------
SELECT
  p.id,
  p.lugar,
  COUNT(DISTINCT s.id) AS groups_count,
  COUNT(t.id)          AS trees_count
FROM plantations p
LEFT JOIN subgroups s ON s.plantacion_id = p.id
LEFT JOIN trees     t ON t.subgrupo_id   = s.id
WHERE p.id::text LIKE '00000000%'  -- expand list with all 11 UUIDs from MIGR-07
   OR p.id::text LIKE 'e072775e%'
   OR p.id::text LIKE '80b85acd%'
   OR p.id::text LIKE '26e190db%'
   OR p.id::text LIKE '747981d3%'
   OR p.id::text LIKE '0eea0006%'
   OR p.id::text LIKE 'a536bd66%'
   OR p.id::text LIKE '09a315e2%'
   OR p.id::text LIKE '203beee5%'
   OR p.id::text LIKE '6d2e80b0%'
   OR p.id::text LIKE '7fea8850%'
GROUP BY p.id, p.lugar
ORDER BY p.lugar;

-- ---------------------------------------------------------------------------
-- 4. Sincronizada normalization scope — verify MIGR-08 (expected 269 groups)
-- ---------------------------------------------------------------------------
SELECT
  estado,
  COUNT(*) AS groups_count
FROM subgroups
GROUP BY estado
ORDER BY estado;

-- ---------------------------------------------------------------------------
-- 5. Edge case scans — abort triggers per CONTEXT.md D-08
-- ---------------------------------------------------------------------------

-- 5a. Subgroups with NULL or empty codigo
SELECT id, plantacion_id, nombre, codigo
FROM subgroups
WHERE codigo IS NULL OR trim(codigo) = '';

-- 5b. Trees without a parent subgroup (orphan FK)
SELECT t.id, t.subgrupo_id
FROM trees t
LEFT JOIN subgroups s ON s.id = t.subgrupo_id
WHERE s.id IS NULL;

-- 5c. Trees with NULL subId or empty
SELECT id, subgrupo_id, sub_id, posicion
FROM trees
WHERE sub_id IS NULL OR trim(sub_id) = '';

-- 5d. Existing rows with tipo='parcela' (REQUIREMENTS expects 0 — abort if any)
SELECT id, plantacion_id, nombre, codigo, tipo
FROM subgroups
WHERE tipo = 'parcela';

-- 5e. Duplicate (plantacion_id, codigo) within current schema — should be 0
--     because of the existing per-plantation unique index
SELECT plantacion_id, codigo, COUNT(*)
FROM subgroups
GROUP BY plantacion_id, codigo
HAVING COUNT(*) > 1;

-- 5f. Grand totals (cross-check against MIGR-04..07)
SELECT
  (SELECT COUNT(*) FROM plantations) AS total_plantations,
  (SELECT COUNT(*) FROM subgroups)   AS total_groups,
  (SELECT COUNT(*) FROM trees)       AS total_trees;
