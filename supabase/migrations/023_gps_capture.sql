-- Migration 023: captura GPS en registro de árboles (milestone GPS, issue #96)
--
-- 1. trees: columnas del punto capturado al registrar (nullable: árboles
--    históricos quedan sin punto; no hay backfill).
-- 2. plantations: configuración por plantación — frecuencia de captura
--    (default 10, duplicado de GPS_CAPTURE_FREQUENCY_DEFAULT) y obligatoriedad
--    (default true, duplicado de GPS_CAPTURE_REQUIRED_DEFAULT), ambos en
--    mobile/src/constants/gpsCapture.ts (SQL no puede importar la constante).
--    Obligatoria por default: las plantaciones pre-feature exigen GPS hasta que
--    el admin lo desactive.
-- 3. sync_subgroup: redefinido PARTIENDO DE LA VERSIÓN 022 (la vigente).
--    El INSERT de árboles y el ON CONFLICT persisten las 4 columnas nuevas,
--    con COALESCE para no pisar coordenadas ya guardadas con NULL (clientes
--    viejos sin las columnas siguen sincronizando: sus claves ausentes en el
--    JSON quedan NULL y el COALESCE preserva lo que haya en server).

ALTER TABLE trees ADD COLUMN latitude double precision;
ALTER TABLE trees ADD COLUMN longitude double precision;
ALTER TABLE trees ADD COLUMN gps_accuracy double precision;
ALTER TABLE trees ADD COLUMN gps_captured_at timestamptz;

ALTER TABLE plantations
  ADD COLUMN gps_capture_frequency integer NOT NULL DEFAULT 10
  CHECK (gps_capture_frequency >= 1);
ALTER TABLE plantations
  ADD COLUMN gps_capture_required boolean NOT NULL DEFAULT true;

-- Body idéntico a 022 salvo las 4 columnas GPS de trees (INSERT + ON CONFLICT).
CREATE OR REPLACE FUNCTION sync_subgroup(
  p_subgroup JSONB,
  p_trees    JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM groups
    WHERE parcela_id = (p_subgroup->>'parcela_id')::UUID
      AND codigo = p_subgroup->>'codigo'
      AND id <> (p_subgroup->>'id')::UUID
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_CODE');
  END IF;

  INSERT INTO groups (id, plantation_id, parcela_id, nombre, codigo, tipo, estado, usuario_creador, created_at)
  VALUES (
    (p_subgroup->>'id')::UUID,
    (p_subgroup->>'plantation_id')::UUID,
    (p_subgroup->>'parcela_id')::UUID,
    p_subgroup->>'nombre',
    p_subgroup->>'codigo',
    p_subgroup->>'tipo',
    CASE WHEN p_subgroup->>'estado' IN ('activa', 'finalizada')
         THEN p_subgroup->>'estado'
         ELSE 'finalizada' END,
    (p_subgroup->>'usuario_creador')::UUID,
    (p_subgroup->>'created_at')::TIMESTAMPTZ
  )
  ON CONFLICT (id) DO UPDATE SET
    estado = EXCLUDED.estado;

  INSERT INTO trees (
    id, group_id, species_id, posicion, sub_id, foto_url,
    plantacion_id, global_id, usuario_registro, created_at,
    latitude, longitude, gps_accuracy, gps_captured_at
  )
  SELECT
    (t->>'id')::UUID,
    COALESCE((t->>'group_id')::UUID, (t->>'subgroup_id')::UUID),
    NULLIF(t->>'species_id', '')::UUID,
    (t->>'posicion')::INTEGER,
    t->>'sub_id',
    t->>'foto_url',
    (t->>'plantacion_id')::INTEGER,
    (t->>'global_id')::INTEGER,
    (t->>'usuario_registro')::UUID,
    (t->>'created_at')::TIMESTAMPTZ,
    (t->>'latitude')::DOUBLE PRECISION,
    (t->>'longitude')::DOUBLE PRECISION,
    (t->>'gps_accuracy')::DOUBLE PRECISION,
    (t->>'gps_captured_at')::TIMESTAMPTZ
  FROM jsonb_array_elements(p_trees) AS t
  ON CONFLICT (id) DO UPDATE SET
    species_id = EXCLUDED.species_id,
    sub_id = EXCLUDED.sub_id,
    -- Conservar valores existentes si el push trae NULL (no borrar fotos, IDs
    -- ni coordenadas ya persistidas).
    foto_url = COALESCE(EXCLUDED.foto_url, trees.foto_url),
    plantacion_id = COALESCE(EXCLUDED.plantacion_id, trees.plantacion_id),
    global_id = COALESCE(EXCLUDED.global_id, trees.global_id),
    latitude = COALESCE(EXCLUDED.latitude, trees.latitude),
    longitude = COALESCE(EXCLUDED.longitude, trees.longitude),
    gps_accuracy = COALESCE(EXCLUDED.gps_accuracy, trees.gps_accuracy),
    gps_captured_at = COALESCE(EXCLUDED.gps_captured_at, trees.gps_captured_at);

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'UNKNOWN');
END;
$$;

GRANT EXECUTE ON FUNCTION sync_subgroup(JSONB, JSONB) TO authenticated;
