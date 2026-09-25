-- Edición de la plantación campo por campo, con detección de conflictos (#634).
--
-- Una edición offline subía todos los campos con un UPDATE ciego y pisaba lo que
-- se hubiera cambiado en la web mientras tanto. `editar_plantacion` recibe, junto
-- con cada cambio, el valor que el cliente tenía cuando editó (la base): aplica el
-- campo si el server sigue con ese valor y, si no, lo devuelve como conflicto.
--
-- Además, la policy UPDATE de `plantations` no restringía columnas: un admin
-- podía cambiar `estado`, `organizacion_id` o `creado_por` por PostgREST.

-- ── A. Los campos editables, en un solo lugar ────────────────────────────────

CREATE OR REPLACE FUNCTION "public"."campos_editables_de_plantacion"() RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT ARRAY[
    'lugar', 'periodo', 'descripcion', 'fecha_inicio', 'objetivo_arboles',
    'gps_capture_frequency', 'gps_capture_required', 'photo_capture_all_trees', 'visible_in_app'
  ];
$$;

ALTER FUNCTION "public"."campos_editables_de_plantacion"() OWNER TO "postgres";

-- ── B. Quién y cuándo cambió cada campo ──────────────────────────────────────

-- `{campo: {por, en}}`. Por campo y no por fila: si Ana cambia el objetivo y
-- después Juan la descripción, el conflicto del objetivo tiene que decir "Ana".
-- Lo llena un trigger, así también registra un UPDATE directo (APKs viejos).
ALTER TABLE "public"."plantations"
  ADD COLUMN IF NOT EXISTS "ultima_edicion" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL;

CREATE OR REPLACE FUNCTION "public"."registrar_edicion_de_plantacion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_viejo JSONB := to_jsonb(OLD);
  v_nuevo JSONB := to_jsonb(NEW);
  v_campo TEXT;
BEGIN
  FOREACH v_campo IN ARRAY campos_editables_de_plantacion() LOOP
    IF v_viejo -> v_campo IS DISTINCT FROM v_nuevo -> v_campo THEN
      NEW.ultima_edicion := NEW.ultima_edicion
        || jsonb_build_object(v_campo, jsonb_build_object('por', auth.uid(), 'en', now()));
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."registrar_edicion_de_plantacion"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "trg_registrar_edicion_de_plantacion" ON "public"."plantations";
CREATE TRIGGER "trg_registrar_edicion_de_plantacion"
  BEFORE UPDATE ON "public"."plantations"
  FOR EACH ROW EXECUTE FUNCTION "public"."registrar_edicion_de_plantacion"();

-- ── C. El UPDATE directo solo toca los campos editables ──────────────────────

-- Por privilegio de columna y no por trigger: una columna nueva queda cerrada
-- hasta que alguien la habilite a propósito. Los RPC SECURITY DEFINER (archivar,
-- reabrir, eliminar, `editar_plantacion`) corren como postgres y no pasan por acá.
-- Los campos editables siguen abiertos para los APKs que editan con UPDATE.
REVOKE UPDATE ON TABLE "public"."plantations" FROM "anon", "authenticated";
GRANT UPDATE (
  "lugar", "periodo", "descripcion", "fecha_inicio", "objetivo_arboles",
  "gps_capture_frequency", "gps_capture_required", "photo_capture_all_trees", "visible_in_app",
  "estado"
) ON TABLE "public"."plantations" TO "authenticated";

-- `estado` queda con UPDATE solo para finalizar, que en mobile es exactamente
-- `activa → finalizada` y que los APKs instalados hacen así. Cualquier otro
-- cambio (reabrir sin `reabrir_plantacion`) se rechaza. SECURITY INVOKER a
-- propósito: dentro de un RPC `current_user` es postgres y el trigger no aplica.
CREATE OR REPLACE FUNCTION "public"."proteger_estado_de_plantacion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND NEW.estado IS DISTINCT FROM OLD.estado
     AND NOT (OLD.estado = 'activa' AND NEW.estado = 'finalizada') THEN
    RAISE EXCEPTION 'El estado de una plantación solo cambia al finalizarla o con reabrir_plantacion'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."proteger_estado_de_plantacion"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "trg_proteger_estado_de_plantacion" ON "public"."plantations";
CREATE TRIGGER "trg_proteger_estado_de_plantacion"
  BEFORE UPDATE OF "estado" ON "public"."plantations"
  FOR EACH ROW EXECUTE FUNCTION "public"."proteger_estado_de_plantacion"();

-- ── D. Validación, igual a la de la web ──────────────────────────────────────

CREATE OR REPLACE FUNCTION "public"."entero_positivo"("p_valor" "jsonb") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT jsonb_typeof(p_valor) = 'number'
    AND (p_valor #>> '{}')::numeric >= 1
    AND (p_valor #>> '{}')::numeric <= 2147483647
    AND (p_valor #>> '{}')::numeric = trunc((p_valor #>> '{}')::numeric);
$$;

-- YYYY-MM-DD y una fecha real (el 2026-02-30 no pasa).
CREATE OR REPLACE FUNCTION "public"."fecha_iso"("p_valor" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  IF jsonb_typeof(p_valor) <> 'string' OR (p_valor #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RETURN false;
  END IF;
  PERFORM (p_valor #>> '{}')::date;
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

-- NULL = todo válido; si no, el primer campo que falla. También falla un campo
-- que no es editable o que viene sin base: sin base no hay con qué comparar.
CREATE OR REPLACE FUNCTION "public"."campo_invalido_de_plantacion"("p_cambios" "jsonb", "p_base" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_campo TEXT;
  v_valor JSONB;
  v_tipo TEXT;
BEGIN
  FOR v_campo, v_valor IN SELECT key, value FROM jsonb_each(p_cambios) LOOP
    v_tipo := jsonb_typeof(v_valor);
    IF NOT (v_campo = ANY (campos_editables_de_plantacion())) OR NOT (p_base ? v_campo) THEN
      RETURN v_campo;
    END IF;
    IF v_campo IN ('lugar', 'periodo') AND NOT (v_tipo = 'string' AND btrim(v_valor #>> '{}') <> '') THEN
      RETURN v_campo;
    END IF;
    IF v_campo = 'descripcion' AND v_tipo NOT IN ('string', 'null') THEN
      RETURN v_campo;
    END IF;
    IF v_campo IN ('gps_capture_required', 'photo_capture_all_trees', 'visible_in_app') AND v_tipo <> 'boolean' THEN
      RETURN v_campo;
    END IF;
    IF v_campo = 'gps_capture_frequency' AND NOT entero_positivo(v_valor) THEN
      RETURN v_campo;
    END IF;
    IF v_campo = 'objetivo_arboles' AND v_tipo <> 'null' AND NOT entero_positivo(v_valor) THEN
      RETURN v_campo;
    END IF;
    IF v_campo = 'fecha_inicio' AND v_tipo <> 'null' AND NOT fecha_iso(v_valor) THEN
      RETURN v_campo;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."campo_invalido_de_plantacion"("jsonb", "jsonb") OWNER TO "postgres";
ALTER FUNCTION "public"."entero_positivo"("jsonb") OWNER TO "postgres";
ALTER FUNCTION "public"."fecha_iso"("jsonb") OWNER TO "postgres";

-- ── E. editar_plantacion ─────────────────────────────────────────────────────

-- El detalle de un campo que chocó: el valor del server y, si se sabe, quién lo
-- cambió (nombre) y cuándo.
CREATE OR REPLACE FUNCTION "public"."conflicto_de_campo"("p_actual" "jsonb", "p_campo" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT jsonb_build_object(
    'campo', p_campo,
    'valor_servidor', p_actual -> p_campo,
    'editado_por', (SELECT nombre FROM profiles
                    WHERE id = (p_actual -> 'ultima_edicion' -> p_campo ->> 'por')::uuid),
    'editado_en', p_actual -> 'ultima_edicion' -> p_campo -> 'en'
  );
$$;

ALTER FUNCTION "public"."conflicto_de_campo"("jsonb", "text") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."conflicto_de_campo"("jsonb", "text") FROM PUBLIC, "anon", "authenticated";

-- `p_cambios` y `p_base`: `{columna: valor}`. Un campo se aplica si el server
-- tiene el valor de la base, o si ya tiene el valor nuevo (los dos cambiaron a lo
-- mismo). Los demás vuelven en `conflictos` y NO se aplican; el resto sí, en la
-- misma transacción: con conflictos la respuesta es `success: false` pero los
-- campos de `aplicados` quedaron guardados.
CREATE OR REPLACE FUNCTION "public"."editar_plantacion"("p_id" "uuid", "p_cambios" "jsonb", "p_base" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cambios JSONB := coalesce(p_cambios, '{}');
  v_base JSONB := coalesce(p_base, '{}');
  v_actual JSONB;
  v_rechazo TEXT;
  v_campo TEXT;
  v_aplicar JSONB := '{}';
  v_conflictos JSONB := '[]';
BEGIN
  -- Bloquea la fila: el gate y la comparación con la base no pueden quedar viejos.
  SELECT to_jsonb(p) INTO v_actual FROM plantations p WHERE id = p_id FOR UPDATE;

  v_rechazo := rechazo_configuracion_plantacion(p_id, plantacion_escribible(p_id));
  IF v_rechazo IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_rechazo);
  END IF;

  v_campo := campo_invalido_de_plantacion(v_cambios, v_base);
  IF v_campo IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'DATOS_INVALIDOS', 'campo', v_campo);
  END IF;

  FOR v_campo IN SELECT jsonb_object_keys(v_cambios) LOOP
    IF v_actual -> v_campo IN (v_base -> v_campo, v_cambios -> v_campo) THEN
      v_aplicar := v_aplicar || jsonb_build_object(v_campo, v_cambios -> v_campo);
    ELSE
      v_conflictos := v_conflictos || conflicto_de_campo(v_actual, v_campo);
    END IF;
  END LOOP;

  UPDATE plantations SET
    lugar = CASE WHEN v_aplicar ? 'lugar' THEN v_aplicar ->> 'lugar' ELSE lugar END,
    periodo = CASE WHEN v_aplicar ? 'periodo' THEN v_aplicar ->> 'periodo' ELSE periodo END,
    descripcion = CASE WHEN v_aplicar ? 'descripcion' THEN v_aplicar ->> 'descripcion' ELSE descripcion END,
    fecha_inicio = CASE WHEN v_aplicar ? 'fecha_inicio' THEN (v_aplicar ->> 'fecha_inicio')::date ELSE fecha_inicio END,
    objetivo_arboles = CASE WHEN v_aplicar ? 'objetivo_arboles' THEN (v_aplicar ->> 'objetivo_arboles')::integer ELSE objetivo_arboles END,
    gps_capture_frequency = CASE WHEN v_aplicar ? 'gps_capture_frequency' THEN (v_aplicar ->> 'gps_capture_frequency')::integer ELSE gps_capture_frequency END,
    gps_capture_required = CASE WHEN v_aplicar ? 'gps_capture_required' THEN (v_aplicar ->> 'gps_capture_required')::boolean ELSE gps_capture_required END,
    photo_capture_all_trees = CASE WHEN v_aplicar ? 'photo_capture_all_trees' THEN (v_aplicar ->> 'photo_capture_all_trees')::boolean ELSE photo_capture_all_trees END,
    visible_in_app = CASE WHEN v_aplicar ? 'visible_in_app' THEN (v_aplicar ->> 'visible_in_app')::boolean ELSE visible_in_app END
  WHERE id = p_id AND v_aplicar <> '{}';

  IF jsonb_array_length(v_conflictos) > 0 THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'CONFLICTO_EDICION',
      'aplicados', (SELECT coalesce(jsonb_agg(k), '[]') FROM jsonb_object_keys(v_aplicar) AS k),
      'conflictos', v_conflictos
    );
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

ALTER FUNCTION "public"."editar_plantacion"("uuid", "jsonb", "jsonb") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."editar_plantacion"("uuid", "jsonb", "jsonb") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."editar_plantacion"("uuid", "jsonb", "jsonb") TO "authenticated", "service_role";
