-- Reemplazar las especies o los técnicos de una plantación en una sola transacción (#544).
--
-- El móvil borraba y después insertaba en dos requests: si el segundo fallaba, la
-- plantación quedaba sin especies (la botonera se vacía en todos los celulares) o
-- sin técnicos (pierden el acceso). Estos RPC hacen las dos cosas juntas.
--
-- Son SECURITY DEFINER, así que aplican por su cuenta los gates de las policies:
-- admin activo, plantación de su organización, y escribible (especies) o que admita
-- asignaciones (técnicos, también en una finalizada). Un rechazo vuelve como
-- `{success: false, error}`; un error inesperado aborta la transacción entera.

-- ── A. Gate común ────────────────────────────────────────────────────────────

-- NULL = puede escribir. `p_admite` es el predicado de escritura de la tabla.
-- Inexistente se informa antes que la organización para que el cliente muestre
-- "ya no existe"; `motivo_no_escribible` ya expone ese dato a cualquier autenticado.
CREATE OR REPLACE FUNCTION "public"."rechazo_configuracion_plantacion"("p_plantation_id" "uuid", "p_admite" boolean) RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN NOT is_admin() THEN 'NOT_AUTHORIZED'
    WHEN NOT EXISTS (SELECT 1 FROM plantations WHERE id = p_plantation_id) THEN 'PLANTACION_INEXISTENTE'
    WHEN NOT plantacion_de_mi_organizacion(p_plantation_id) THEN 'NOT_AUTHORIZED'
    WHEN NOT p_admite THEN motivo_no_escribible(p_plantation_id)
  END;
$$;

-- Interno: quien lo llama decide `p_admite`.
ALTER FUNCTION "public"."rechazo_configuracion_plantacion"("uuid", boolean) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."rechazo_configuracion_plantacion"("uuid", boolean) FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."rechazo_configuracion_plantacion"("uuid", boolean) TO "service_role";

-- ── B. Especies ──────────────────────────────────────────────────────────────

-- `p_especies`: [{species_id, orden_visual}]. El FOR SHARE espera a un archivado,
-- finalizado o borrado en curso, así el gate no queda viejo antes de escribir.
CREATE OR REPLACE FUNCTION "public"."reemplazar_especies_plantacion"("p_plantacion" "uuid", "p_especies" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_especies JSONB := coalesce(p_especies, '[]');
  v_rechazo TEXT;
BEGIN
  PERFORM 1 FROM plantations WHERE id = p_plantacion FOR SHARE;

  v_rechazo := rechazo_configuracion_plantacion(p_plantacion, plantacion_escribible(p_plantacion));
  IF v_rechazo IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_rechazo);
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_especies) AS e(valor)
    LEFT JOIN species s ON s.id = (e.valor->>'species_id')::UUID
    WHERE s.id IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ESPECIE_INEXISTENTE');
  END IF;

  DELETE FROM plantation_species WHERE plantation_id = p_plantacion;

  INSERT INTO plantation_species (plantation_id, species_id, orden_visual)
  SELECT p_plantacion, (e.valor->>'species_id')::UUID, coalesce((e.valor->>'orden_visual')::INTEGER, 0)
  FROM jsonb_array_elements(v_especies) AS e(valor);

  RETURN jsonb_build_object('success', true);
END;
$$;

ALTER FUNCTION "public"."reemplazar_especies_plantacion"("uuid", "jsonb") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."reemplazar_especies_plantacion"("uuid", "jsonb") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."reemplazar_especies_plantacion"("uuid", "jsonb") TO "authenticated", "service_role";

-- ── C. Técnicos ──────────────────────────────────────────────────────────────

-- Solo toca filas `tecnico`: las `admin` son de los triggers. Un usuario de la lista
-- que ya es miembro conserva su fila (y su `assigned_at`).
--
-- Los técnicos inactivos no se ofrecen en la pantalla, así que no se quitan: al
-- reactivarlos recuperan el acceso tal cual (#508).
CREATE OR REPLACE FUNCTION "public"."reemplazar_tecnicos_plantacion"("p_plantacion" "uuid", "p_user_ids" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_ids UUID[] := coalesce(p_user_ids, '{}');
  v_rechazo TEXT;
BEGIN
  PERFORM 1 FROM plantations WHERE id = p_plantacion FOR SHARE;

  v_rechazo := rechazo_configuracion_plantacion(p_plantacion, plantacion_admite_asignaciones(p_plantacion));
  IF v_rechazo IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_rechazo);
  END IF;

  IF EXISTS (SELECT 1 FROM unnest(v_ids) AS u(id) WHERE NOT perfil_de_mi_organizacion(u.id)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_DE_OTRA_ORGANIZACION');
  END IF;

  DELETE FROM plantation_users pu
  USING profiles pr
  WHERE pu.plantation_id = p_plantacion
    AND pu.rol_en_plantacion = 'tecnico'
    AND pr.id = pu.user_id
    AND pr.activo
    AND pu.user_id <> ALL (v_ids);

  INSERT INTO plantation_users (plantation_id, user_id, rol_en_plantacion)
  SELECT DISTINCT p_plantacion, u.id, 'tecnico'
  FROM unnest(v_ids) AS u(id)
  ON CONFLICT (plantation_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

ALTER FUNCTION "public"."reemplazar_tecnicos_plantacion"("uuid", "uuid"[]) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."reemplazar_tecnicos_plantacion"("uuid", "uuid"[]) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."reemplazar_tecnicos_plantacion"("uuid", "uuid"[]) TO "authenticated", "service_role";
