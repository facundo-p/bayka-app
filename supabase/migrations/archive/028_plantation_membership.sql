-- Migration 028: Membresía por plantación como fuente de permisos (issue #67)
--
-- Hasta ahora el control de escritura estaba repartido en tres modelos:
--   - plantations/plantation_species/plantation_users: rol global admin (003/024)
--   - parcelas: membresía en plantation_users (012) + parche admin-global (021/024)
--   - groups/trees: RPC sync_subgroup SECURITY DEFINER sin ningún control
--
-- Este cambio unifica: plantation_users pasa a ser la fuente de verdad para la
-- escritura de parcelas y grupos/árboles. Decisiones (issue #67):
--   - Al crear una plantación, TODOS los admins activos quedan como miembros
--     con rol_en_plantacion='admin' (preserva el comportamiento actual:
--     cualquier admin opera cualquier plantación).
--   - Un perfil promovido a admin se agrega a todas las plantaciones; uno
--     degradado pierde sus membresías 'admin' (las 'tecnico' asignadas a mano
--     no se tocan).
--   - sync_subgroup mantiene SECURITY DEFINER pero valida membresía del caller
--     (guard interno; mismo criterio que las policies member-based de parcelas).
--   - Se retira el parche admin-global de parcelas (021, reescrito en 024):
--     con el backfill ya es redundante y dejaría dos fuentes de permisos.
--
-- La desactivación de un perfil (activo=false) NO retira membresías acá: el
-- gate de cuentas inactivas vive en el login/edge functions (026).

BEGIN;

-- ── 1. Dominio de rol_en_plantacion (hasta hoy, text libre) ──────────────────
ALTER TABLE plantation_users
  ADD CONSTRAINT plantation_users_rol_check
  CHECK (rol_en_plantacion IN ('admin', 'tecnico'));

-- ── 2. Alta automática: nueva plantación → todos los admins activos ─────────
CREATE OR REPLACE FUNCTION add_admin_memberships_to_plantation()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO plantation_users (plantation_id, user_id, rol_en_plantacion)
  SELECT NEW.id, pr.id, 'admin'
  FROM profiles pr
  WHERE pr.rol IN ('admin', 'superadmin') AND pr.activo
  ON CONFLICT (plantation_id, user_id) DO UPDATE
    SET rol_en_plantacion = 'admin';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_admin_memberships ON plantations;
CREATE TRIGGER trg_add_admin_memberships
  AFTER INSERT ON plantations
  FOR EACH ROW EXECUTE FUNCTION add_admin_memberships_to_plantation();

-- ── 3. Alta/baja automática al cambiar el rol global de un perfil ───────────
CREATE OR REPLACE FUNCTION sync_admin_memberships_on_rol_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.rol IN ('admin', 'superadmin') AND NEW.activo THEN
    INSERT INTO plantation_users (plantation_id, user_id, rol_en_plantacion)
    SELECT p.id, NEW.id, 'admin'
    FROM plantations p
    ON CONFLICT (plantation_id, user_id) DO UPDATE
      SET rol_en_plantacion = 'admin';
  ELSIF TG_OP = 'UPDATE'
        AND OLD.rol IN ('admin', 'superadmin')
        AND NEW.rol NOT IN ('admin', 'superadmin') THEN
    -- Degradado: pierde solo las membresías que le dio el rol global.
    DELETE FROM plantation_users
    WHERE user_id = NEW.id AND rol_en_plantacion = 'admin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_admin_memberships ON profiles;
CREATE TRIGGER trg_sync_admin_memberships
  AFTER INSERT OR UPDATE OF rol ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_admin_memberships_on_rol_change();

-- ── 4. Backfill: admins activos → miembros de todas las plantaciones ────────
INSERT INTO plantation_users (plantation_id, user_id, rol_en_plantacion)
SELECT p.id, pr.id, 'admin'
FROM plantations p
CROSS JOIN profiles pr
WHERE pr.rol IN ('admin', 'superadmin') AND pr.activo
ON CONFLICT (plantation_id, user_id) DO UPDATE
  SET rol_en_plantacion = 'admin';

-- ── 5. sync_subgroup: guard de membresía (cuerpo = 023 + guard) ──────────────
-- SECURITY DEFINER bypassea RLS, así que hasta hoy CUALQUIER authenticated
-- podía escribir grupos/árboles de cualquier plantación. El guard exige ser
-- miembro (cualquier rol_en_plantacion) de la plantación destino, igual que
-- las policies member-based de parcelas. Devuelve error 'PERMISSION' (código
-- que el cliente ya clasifica y muestra).
CREATE OR REPLACE FUNCTION sync_subgroup(
  p_subgroup JSONB,
  p_trees    JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM plantation_users pu
    WHERE pu.plantation_id = (p_subgroup->>'plantation_id')::UUID
      AND pu.user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION');
  END IF;

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

-- ── 6. Retiro del parche admin-global de parcelas (021 → 024) ────────────────
-- Con los admins como miembros, las policies member-based de 012 cubren todos
-- los casos. Dejar ambas vías sería mantener dos fuentes de permisos.
DROP POLICY IF EXISTS "Admin can insert parcelas" ON parcelas;
DROP POLICY IF EXISTS "Admin can update parcelas" ON parcelas;
DROP POLICY IF EXISTS "Admin can delete parcelas" ON parcelas;

COMMIT;
