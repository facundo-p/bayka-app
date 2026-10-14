-- Técnicos de la plantación por altas y bajas (#636).
--
-- `reemplazar_tecnicos_plantacion` (049) recibe la lista entera: un teléfono que
-- asignó offline pisaría lo que la web cambió en el medio. Con altas y bajas cada
-- lado toca solo lo suyo, y reintentar no cambia el resultado.
--
-- Mismos gates que 049: admin activo, plantación de su organización y que admita
-- asignaciones (también una finalizada). Un rechazo de la plantación vuelve como
-- `{success: false, error}` y no aplica nada. Un usuario de otra organización, que
-- no es técnico o dado de baja se rechaza solo, en `rechazados`, y el resto se
-- aplica: la cola del teléfono lo descarta y avisa.
--
-- Solo toca filas `tecnico`: las `admin` son de los triggers. Un usuario en las
-- dos listas cuenta como alta.

CREATE OR REPLACE FUNCTION "public"."aplicar_cambios_tecnicos"("p_plantacion" "uuid", "p_altas" "uuid"[], "p_bajas" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_altas UUID[] := coalesce(p_altas, '{}');
  v_bajas UUID[] := coalesce(p_bajas, '{}');
  v_rechazo TEXT;
  v_rechazados JSONB;
BEGIN
  PERFORM 1 FROM plantations WHERE id = p_plantacion FOR SHARE;

  v_rechazo := rechazo_configuracion_plantacion(p_plantacion, plantacion_admite_asignaciones(p_plantacion));
  IF v_rechazo IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_rechazo);
  END IF;

  -- La organización va primero: de otra organización no se informa si está activo.
  SELECT coalesce(jsonb_agg(jsonb_build_object('user_id', r.id, 'error', r.error) ORDER BY r.id), '[]')
    INTO v_rechazados
    FROM (
      SELECT DISTINCT a.id,
             CASE WHEN NOT perfil_de_mi_organizacion(a.id) THEN 'USUARIO_DE_OTRA_ORGANIZACION'
                  WHEN pr.rol <> 'tecnico' THEN 'NO_ES_TECNICO'
                  WHEN NOT pr.activo THEN 'TECNICO_INACTIVO' END AS error
        FROM unnest(v_altas) AS a(id)
        LEFT JOIN profiles pr ON pr.id = a.id
    ) r
   WHERE r.error IS NOT NULL;

  INSERT INTO plantation_users (plantation_id, user_id, rol_en_plantacion)
  SELECT DISTINCT p_plantacion, a.id, 'tecnico'
    FROM unnest(v_altas) AS a(id)
    JOIN profiles pr ON pr.id = a.id
   WHERE pr.activo AND pr.rol = 'tecnico' AND perfil_de_mi_organizacion(a.id)
  ON CONFLICT (plantation_id, user_id) DO NOTHING;

  DELETE FROM plantation_users
   WHERE plantation_id = p_plantacion
     AND rol_en_plantacion = 'tecnico'
     AND user_id = ANY (v_bajas)
     AND NOT (user_id = ANY (v_altas));

  RETURN jsonb_build_object('success', true, 'rechazados', v_rechazados);
END;
$$;

ALTER FUNCTION "public"."aplicar_cambios_tecnicos"("uuid", "uuid"[], "uuid"[]) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."aplicar_cambios_tecnicos"("uuid", "uuid"[], "uuid"[]) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."aplicar_cambios_tecnicos"("uuid", "uuid"[], "uuid"[]) TO "authenticated", "service_role";
