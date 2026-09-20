-- Los dos gates de rol que todavía estaban escritos a mano, y una policy sin
-- objeto (#314, derivado de #310).
--
-- El inventario de policies de escritura quedó sin un solo `EXISTS (SELECT 1
-- FROM profiles … rol = ANY (ARRAY['admin','superadmin']))` inline: 045 y 048
-- los pasaron todos a `is_admin()`, `is_superadmin()`, `is_plantation_member()`
-- y `plantacion_de_mi_organizacion()`. Lo que quedaba del issue son dos
-- funciones —no policies— que repetían el predicado, y un DELETE que ninguna
-- superficie usa.
--
-- Sin cambios de semántica: los tres predicados nuevos son equivalentes a los
-- que reemplazan. Lo que cambia es que el día que un helper se corrija —como
-- pasó con `activo` en #506— la corrección llegue también acá.

-- ── A. generate_tree_ids usa el helper que su propio comentario citaba ───────

-- El inline decía "mismo predicado que `puede_archivar_plantacion`". Ahora lo
-- es. Único matiz: el helper compara contra `current_organizacion_id()` en vez
-- de joinear `profiles`↔`plantations`; con `is_admin()` exigiendo activo
-- (043) y el helper de organización devolviendo NULL para un inactivo (050),
-- el resultado es el mismo. El resto de la función queda igual.
CREATE OR REPLACE FUNCTION "public"."generate_tree_ids"("p_plantation_id" "uuid", "p_seed" integer DEFAULT NULL::integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_total INTEGER;
  v_con_id INTEGER;
  v_seed INTEGER;
  v_updated INTEGER;
BEGIN
  -- Plantación inexistente o ajena dan el mismo error: no se filtra su existencia.
  IF NOT puede_archivar_plantacion(p_plantation_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;

  -- Bloquea la fila contra un archivado concurrente: si se archivó antes, el
  -- chequeo de abajo ya lo ve; si no, el archivado espera a que esto termine.
  PERFORM 1 FROM plantations WHERE id = p_plantation_id FOR SHARE;

  IF motivo_no_escribible(p_plantation_id) = 'PLANTACION_ARCHIVADA' THEN
    RETURN jsonb_build_object('success', false, 'error', 'PLANTACION_ARCHIVADA');
  END IF;

  -- Serializa generaciones concurrentes: el seed por defecto lee MAX(global_id)
  -- de TODAS las trees; dos corridas en paralelo duplicarían rangos.
  PERFORM pg_advisory_xact_lock(hashtext('generate_tree_ids'));

  SELECT total, con_id INTO v_total, v_con_id FROM plantation_ids_status(p_plantation_id);

  IF v_total = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_TREES');
  END IF;

  -- Idempotencia: cuenta como generado solo si TODOS tienen global_id. Un set
  -- parcial (sync incompleto) se regenera completo, igual que hacía mobile.
  IF v_con_id = v_total THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_GENERATED');
  END IF;

  v_seed := COALESCE(p_seed, next_global_id_seed());
  IF v_seed < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_SEED');
  END IF;

  WITH ordenados AS (
    SELECT t2.id,
           ROW_NUMBER() OVER (ORDER BY g.created_at ASC, t2.posicion ASC, g.id ASC) AS rn
    FROM trees t2
    JOIN groups g ON g.id = t2.group_id
    WHERE g.plantation_id = p_plantation_id
  )
  UPDATE trees t
  SET plantacion_id = o.rn,
      global_id = v_seed + o.rn - 1
  FROM ordenados o
  WHERE t.id = o.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'updated', v_updated, 'seed', v_seed);
END;
$$;

-- ── B. protect_profile_fields usa is_superadmin() ───────────────────────────

-- El `EXISTS` inline ya exigía `activo`, que es justo lo que hace el helper.
-- El resto del trigger queda igual: campos protegidos, conexiones sin usuario
-- (service_role / edge function) permitidas, y la auto-degradación bloqueada.
CREATE OR REPLACE FUNCTION "public"."protect_profile_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Conexiones sin usuario (service_role / dashboard / edge function): permitidas.
  if auth.uid() is null then
    return new;
  end if;
  if new.activo is distinct from old.activo
     or new.email is distinct from old.email
     or new.eliminado_en is distinct from old.eliminado_en then
    raise exception 'El email y el estado de un usuario solo se cambian desde la gestión de usuarios';
  end if;
  if new.rol is distinct from old.rol then
    if not is_superadmin() then
      raise exception 'Solo un superadmin puede cambiar roles';
    end if;
    if old.id = auth.uid() and old.rol = 'superadmin' and new.rol <> 'superadmin' then
      raise exception 'Un superadmin no puede degradarse a sí mismo';
    end if;
  end if;
  return new;
end;
$$;

-- ── C. El DELETE de parcelas no tiene objeto ────────────────────────────────

-- Borrar una parcela es un tombstone: `UPDATE parcelas SET deleted_at`, que
-- sube el push con upsert y filtran los lectores con `is('deleted_at', null)`.
-- No hay un solo `.delete()` contra `parcelas` en la web ni en la app, y el
-- único borrado físico es el cascade de `eliminar_plantacion` (039), que es
-- SECURITY DEFINER y no evalúa RLS. La policy solo ampliaba la superficie.
DROP POLICY IF EXISTS "Plantation members can delete parcelas" ON "public"."parcelas";
