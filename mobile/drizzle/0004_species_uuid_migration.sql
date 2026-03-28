-- Migration 0004: Convert species IDs from sp-XXX format to deterministic UUIDs.
-- Must update child tables FIRST (trees, plantation_species), then parent (species).
-- SQLite has no CASCADE UPDATE, so we do it manually.

-- Step 1: Update trees.especie_id (child FK)
UPDATE trees SET especie_id = 'a0000000-0000-0000-0000-000000000001' WHERE especie_id = 'sp-001';
--> statement-breakpoint
UPDATE trees SET especie_id = 'a0000000-0000-0000-0000-000000000002' WHERE especie_id = 'sp-002';
--> statement-breakpoint
UPDATE trees SET especie_id = 'a0000000-0000-0000-0000-000000000003' WHERE especie_id = 'sp-003';
--> statement-breakpoint
UPDATE trees SET especie_id = 'a0000000-0000-0000-0000-000000000004' WHERE especie_id = 'sp-004';
--> statement-breakpoint
UPDATE trees SET especie_id = 'a0000000-0000-0000-0000-000000000005' WHERE especie_id = 'sp-005';
--> statement-breakpoint
UPDATE trees SET especie_id = 'a0000000-0000-0000-0000-000000000006' WHERE especie_id = 'sp-006';
--> statement-breakpoint
UPDATE trees SET especie_id = 'a0000000-0000-0000-0000-000000000007' WHERE especie_id = 'sp-007';
--> statement-breakpoint
UPDATE trees SET especie_id = 'a0000000-0000-0000-0000-000000000008' WHERE especie_id = 'sp-008';
--> statement-breakpoint
UPDATE trees SET especie_id = 'a0000000-0000-0000-0000-000000000009' WHERE especie_id = 'sp-009';
--> statement-breakpoint
UPDATE trees SET especie_id = 'a0000000-0000-0000-0000-000000000010' WHERE especie_id = 'sp-010';
--> statement-breakpoint

-- Step 2: Update plantation_species.especie_id (child FK)
UPDATE plantation_species SET especie_id = 'a0000000-0000-0000-0000-000000000001' WHERE especie_id = 'sp-001';
--> statement-breakpoint
UPDATE plantation_species SET especie_id = 'a0000000-0000-0000-0000-000000000002' WHERE especie_id = 'sp-002';
--> statement-breakpoint
UPDATE plantation_species SET especie_id = 'a0000000-0000-0000-0000-000000000003' WHERE especie_id = 'sp-003';
--> statement-breakpoint
UPDATE plantation_species SET especie_id = 'a0000000-0000-0000-0000-000000000004' WHERE especie_id = 'sp-004';
--> statement-breakpoint
UPDATE plantation_species SET especie_id = 'a0000000-0000-0000-0000-000000000005' WHERE especie_id = 'sp-005';
--> statement-breakpoint
UPDATE plantation_species SET especie_id = 'a0000000-0000-0000-0000-000000000006' WHERE especie_id = 'sp-006';
--> statement-breakpoint
UPDATE plantation_species SET especie_id = 'a0000000-0000-0000-0000-000000000007' WHERE especie_id = 'sp-007';
--> statement-breakpoint
UPDATE plantation_species SET especie_id = 'a0000000-0000-0000-0000-000000000008' WHERE especie_id = 'sp-008';
--> statement-breakpoint
UPDATE plantation_species SET especie_id = 'a0000000-0000-0000-0000-000000000009' WHERE especie_id = 'sp-009';
--> statement-breakpoint
UPDATE plantation_species SET especie_id = 'a0000000-0000-0000-0000-000000000010' WHERE especie_id = 'sp-010';
--> statement-breakpoint

-- Step 3: Update plantation_species.id (uses old species ID in composite)
UPDATE plantation_species SET id = REPLACE(id, 'sp-001', 'a0000000-0000-0000-0000-000000000001') WHERE id LIKE '%sp-001%';
--> statement-breakpoint
UPDATE plantation_species SET id = REPLACE(id, 'sp-002', 'a0000000-0000-0000-0000-000000000002') WHERE id LIKE '%sp-002%';
--> statement-breakpoint
UPDATE plantation_species SET id = REPLACE(id, 'sp-003', 'a0000000-0000-0000-0000-000000000003') WHERE id LIKE '%sp-003%';
--> statement-breakpoint
UPDATE plantation_species SET id = REPLACE(id, 'sp-004', 'a0000000-0000-0000-0000-000000000004') WHERE id LIKE '%sp-004%';
--> statement-breakpoint
UPDATE plantation_species SET id = REPLACE(id, 'sp-005', 'a0000000-0000-0000-0000-000000000005') WHERE id LIKE '%sp-005%';
--> statement-breakpoint
UPDATE plantation_species SET id = REPLACE(id, 'sp-006', 'a0000000-0000-0000-0000-000000000006') WHERE id LIKE '%sp-006%';
--> statement-breakpoint
UPDATE plantation_species SET id = REPLACE(id, 'sp-007', 'a0000000-0000-0000-0000-000000000007') WHERE id LIKE '%sp-007%';
--> statement-breakpoint
UPDATE plantation_species SET id = REPLACE(id, 'sp-008', 'a0000000-0000-0000-0000-000000000008') WHERE id LIKE '%sp-008%';
--> statement-breakpoint
UPDATE plantation_species SET id = REPLACE(id, 'sp-009', 'a0000000-0000-0000-0000-000000000009') WHERE id LIKE '%sp-009%';
--> statement-breakpoint
UPDATE plantation_species SET id = REPLACE(id, 'sp-010', 'a0000000-0000-0000-0000-000000000010') WHERE id LIKE '%sp-010%';
--> statement-breakpoint

-- Step 4: Update species.id (parent PK — safe now that children are updated)
UPDATE species SET id = 'a0000000-0000-0000-0000-000000000001' WHERE id = 'sp-001';
--> statement-breakpoint
UPDATE species SET id = 'a0000000-0000-0000-0000-000000000002' WHERE id = 'sp-002';
--> statement-breakpoint
UPDATE species SET id = 'a0000000-0000-0000-0000-000000000003' WHERE id = 'sp-003';
--> statement-breakpoint
UPDATE species SET id = 'a0000000-0000-0000-0000-000000000004' WHERE id = 'sp-004';
--> statement-breakpoint
UPDATE species SET id = 'a0000000-0000-0000-0000-000000000005' WHERE id = 'sp-005';
--> statement-breakpoint
UPDATE species SET id = 'a0000000-0000-0000-0000-000000000006' WHERE id = 'sp-006';
--> statement-breakpoint
UPDATE species SET id = 'a0000000-0000-0000-0000-000000000007' WHERE id = 'sp-007';
--> statement-breakpoint
UPDATE species SET id = 'a0000000-0000-0000-0000-000000000008' WHERE id = 'sp-008';
--> statement-breakpoint
UPDATE species SET id = 'a0000000-0000-0000-0000-000000000009' WHERE id = 'sp-009';
--> statement-breakpoint
UPDATE species SET id = 'a0000000-0000-0000-0000-000000000010' WHERE id = 'sp-010';
