-- Update species catalog to match official 33-species reference list.
-- Reuses UUIDs from old entries where possible (code may change).
-- Deletes species no longer in catalog, adds new ones.

BEGIN;

-- 1. Remove old species not in new catalog
--    (cascade will remove plantation_species references too)
DELETE FROM plantation_species
  WHERE species_id NOT IN (
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000005',
    'a0000000-0000-0000-0000-000000000006',
    'a0000000-0000-0000-0000-000000000007',
    'a0000000-0000-0000-0000-000000000008',
    'a0000000-0000-0000-0000-000000000009',
    'a0000000-0000-0000-0000-000000000010'
  );

DELETE FROM species
  WHERE id NOT IN (
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000005',
    'a0000000-0000-0000-0000-000000000006',
    'a0000000-0000-0000-0000-000000000007',
    'a0000000-0000-0000-0000-000000000008',
    'a0000000-0000-0000-0000-000000000009',
    'a0000000-0000-0000-0000-000000000010'
  );

-- 2. Update existing species (reused UUIDs with new names/codes)
UPDATE species SET codigo = 'ANC', nombre = 'Anchico Colorado', nombre_cientifico = NULL WHERE id = 'a0000000-0000-0000-0000-000000000001';
UPDATE species SET codigo = 'IBI', nombre = 'Ibirá Pitá', nombre_cientifico = NULL WHERE id = 'a0000000-0000-0000-0000-000000000002';
UPDATE species SET codigo = 'LAP', nombre = 'Lapacho Negro', nombre_cientifico = NULL WHERE id = 'a0000000-0000-0000-0000-000000000003';
UPDATE species SET codigo = 'TIM', nombre = 'Timbó', nombre_cientifico = NULL WHERE id = 'a0000000-0000-0000-0000-000000000004';
UPDATE species SET codigo = 'PAL', nombre = 'Palo Rosa', nombre_cientifico = NULL WHERE id = 'a0000000-0000-0000-0000-000000000005';
UPDATE species SET codigo = 'GUT', nombre = 'Guatambu', nombre_cientifico = NULL WHERE id = 'a0000000-0000-0000-0000-000000000006';
UPDATE species SET codigo = 'CED', nombre = 'Cedro', nombre_cientifico = NULL WHERE id = 'a0000000-0000-0000-0000-000000000007';
UPDATE species SET codigo = 'LAA', nombre = 'Lapacho Amarillo', nombre_cientifico = NULL WHERE id = 'a0000000-0000-0000-0000-000000000008';
UPDATE species SET codigo = 'GUB', nombre = 'Guayubira', nombre_cientifico = NULL WHERE id = 'a0000000-0000-0000-0000-000000000009';
UPDATE species SET codigo = 'AGU', nombre = 'Aguai', nombre_cientifico = NULL WHERE id = 'a0000000-0000-0000-0000-000000000010';

-- 3. Insert new species
INSERT INTO species (id, codigo, nombre, nombre_cientifico) VALUES
  ('a0000000-0000-0000-0000-000000000011', 'AMB', 'Ambay', NULL),
  ('a0000000-0000-0000-0000-000000000012', 'ARA', 'Araucaria', NULL),
  ('a0000000-0000-0000-0000-000000000013', 'ATI', 'Aratiku', NULL),
  ('a0000000-0000-0000-0000-000000000014', 'CAR', 'Caroba', NULL),
  ('a0000000-0000-0000-0000-000000000015', 'CER', 'Cerella', NULL),
  ('a0000000-0000-0000-0000-000000000016', 'CHI', 'Chichita', NULL),
  ('a0000000-0000-0000-0000-000000000017', 'COC', 'Kokú', NULL),
  ('a0000000-0000-0000-0000-000000000018', 'FUM', 'Fumo Bravo', NULL),
  ('a0000000-0000-0000-0000-000000000019', 'GUA', 'Guabirá', NULL),
  ('a0000000-0000-0000-0000-000000000020', 'GUI', 'Guaporeti', NULL),
  ('a0000000-0000-0000-0000-000000000021', 'LAU', 'Laurel', NULL),
  ('a0000000-0000-0000-0000-000000000022', 'LOR', 'Loro Negro', NULL),
  ('a0000000-0000-0000-0000-000000000023', 'MAR', 'Marmelero', NULL),
  ('a0000000-0000-0000-0000-000000000024', 'MOR', 'Mora Amarilla', NULL),
  ('a0000000-0000-0000-0000-000000000025', 'MPR', 'Maria Preta', NULL),
  ('a0000000-0000-0000-0000-000000000026', 'PAB', 'Palo Borracho', NULL),
  ('a0000000-0000-0000-0000-000000000027', 'PET', 'Peteribi', NULL),
  ('a0000000-0000-0000-0000-000000000028', 'PIT', 'Pitanga', NULL),
  ('a0000000-0000-0000-0000-000000000029', 'PZU', 'Pezuña de Vaca', NULL),
  ('a0000000-0000-0000-0000-000000000030', 'UBA', 'Ubajay', NULL),
  ('a0000000-0000-0000-0000-000000000031', 'CEI', 'Ceibo', NULL),
  ('a0000000-0000-0000-0000-000000000032', 'YER', 'Yerba Mate', NULL),
  ('a0000000-0000-0000-0000-000000000033', 'ZOI', 'Zoita', NULL);

COMMIT;
