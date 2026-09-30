-- Código de plantación (#559): identificador corto que carga el usuario, único por
-- organización. El ID de árbol que el cliente usa en sus informes es
-- `<SubID>-<código>`: el SubID nunca lleva guion, así que el primer guion separa
-- las dos partes (`LP1L23BANC12-SS26-1`).
--
-- `generate_tree_ids`, `global_id` y `plantacion_id` no cambian: conviven con el
-- ID de árbol hasta validarlo con el cliente.

-- ── A. Formato ───────────────────────────────────────────────────────────────

-- Espejo de contracts/codigo-plantacion.json: A-Z, 0-9 y guion, hasta 8; el guion
-- no va al principio, al final ni dos seguidos.
CREATE OR REPLACE FUNCTION "public"."codigo_de_plantacion_valido"("p_codigo" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT p_codigo ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' AND char_length(p_codigo) <= 8;
$$;

ALTER FUNCTION "public"."codigo_de_plantacion_valido"("text") OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."codigo_de_plantacion_valido"("text") TO "authenticated", "service_role";

-- ── B. Columna y backfill ────────────────────────────────────────────────────

ALTER TABLE "public"."plantations" ADD COLUMN IF NOT EXISTS "codigo" "text";

-- Códigos que eligió Facu para las plantaciones de producción.
CREATE OR REPLACE FUNCTION "public"."codigo_manual_de_plantacion"("p_lugar" "text", "p_periodo" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN btrim(p_lugar) = 'San Sebastián de la Selva' AND btrim(p_periodo) = 'Otoño 2026' THEN 'SS26-1'
    WHEN btrim(p_lugar) = 'San Sebastián de la Selva - GSC' AND btrim(p_periodo) = '2026' THEN 'SS26-2'
  END;
$$;

-- Asigna código a las plantaciones que no tienen. Las de producción van por
-- `codigo_manual_de_plantacion`; si una de San Sebastián no calza con ninguna
-- entrada, o calzan dos en la misma organización, falla en vez de inventar uno.
-- El resto (solo existen en staging y desarrollo) recibe `P<n>`, numeradas por
-- organización en orden de creación.
CREATE OR REPLACE FUNCTION "public"."asignar_codigos_de_plantacion_faltantes"() RETURNS void
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_fila RECORD;
BEGIN
  SELECT organizacion_id, codigo_manual_de_plantacion(lugar, periodo) AS codigo INTO v_fila
  FROM plantations
  WHERE codigo IS NULL AND codigo_manual_de_plantacion(lugar, periodo) IS NOT NULL
  GROUP BY 1, 2
  HAVING count(*) > 1
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Más de una plantación calza con el código % en la organización %: asignalo a mano antes de migrar',
      v_fila.codigo, v_fila.organizacion_id;
  END IF;

  UPDATE plantations SET codigo = codigo_manual_de_plantacion(lugar, periodo)
  WHERE codigo IS NULL AND codigo_manual_de_plantacion(lugar, periodo) IS NOT NULL;

  SELECT id, lugar, periodo INTO v_fila
  FROM plantations
  WHERE codigo IS NULL AND lugar ILIKE 'San Sebasti%'
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'La plantación % (% · %) no calza con ningún código manual: asignalo a mano antes de migrar',
      v_fila.id, v_fila.lugar, v_fila.periodo;
  END IF;

  UPDATE plantations p SET codigo = n.codigo
  FROM (
    SELECT id, 'P' || row_number() OVER (PARTITION BY organizacion_id ORDER BY created_at, id) AS codigo
    FROM plantations
    WHERE codigo IS NULL
  ) n
  WHERE p.id = n.id;
END;
$$;

ALTER FUNCTION "public"."codigo_manual_de_plantacion"("text", "text") OWNER TO "postgres";
ALTER FUNCTION "public"."asignar_codigos_de_plantacion_faltantes"() OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."codigo_manual_de_plantacion"("text", "text") FROM PUBLIC, "anon", "authenticated";
REVOKE ALL ON FUNCTION "public"."asignar_codigos_de_plantacion_faltantes"() FROM PUBLIC, "anon", "authenticated";

SELECT "public"."asignar_codigos_de_plantacion_faltantes"();

ALTER TABLE "public"."plantations" ALTER COLUMN "codigo" SET NOT NULL;

ALTER TABLE "public"."plantations" DROP CONSTRAINT IF EXISTS "plantations_codigo_formato";
ALTER TABLE "public"."plantations"
  ADD CONSTRAINT "plantations_codigo_formato" CHECK ("public"."codigo_de_plantacion_valido"("codigo"));

-- Una eliminada es un DELETE físico: su código queda libre.
ALTER TABLE "public"."plantations" DROP CONSTRAINT IF EXISTS "plantations_organizacion_codigo_key";
ALTER TABLE "public"."plantations"
  ADD CONSTRAINT "plantations_organizacion_codigo_key" UNIQUE ("organizacion_id", "codigo");

-- ── C. Solo cambia con la plantación activa ──────────────────────────────────

-- Para todos los roles, superadmin y RPC incluidos: un código ya entregado en un
-- informe no cambia sobre una plantación cerrada.
CREATE OR REPLACE FUNCTION "public"."proteger_codigo_de_plantacion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.codigo IS DISTINCT FROM OLD.codigo
     AND (OLD.estado <> 'activa' OR OLD.archivada_en IS NOT NULL) THEN
    RAISE EXCEPTION 'El código de una plantación solo cambia mientras está activa'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."proteger_codigo_de_plantacion"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "trg_proteger_codigo_de_plantacion" ON "public"."plantations";
CREATE TRIGGER "trg_proteger_codigo_de_plantacion"
  BEFORE UPDATE OF "codigo" ON "public"."plantations"
  FOR EACH ROW EXECUTE FUNCTION "public"."proteger_codigo_de_plantacion"();

-- Sin GRANT UPDATE de la columna: el código se edita solo por `editar_plantacion`.

-- ── D. editar_plantacion ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION "public"."campos_editables_de_plantacion"() RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT ARRAY[
    'lugar', 'periodo', 'descripcion', 'fecha_inicio', 'objetivo_arboles',
    'gps_capture_frequency', 'gps_capture_required', 'photo_capture_all_trees', 'visible_in_app',
    'codigo'
  ];
$$;

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
    IF v_campo = 'codigo' AND NOT (v_tipo = 'string' AND codigo_de_plantacion_valido(v_valor #>> '{}')) THEN
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

-- Cambia respecto de 057: aplica `codigo`. Sobre una finalizada (que un superadmin
-- sí edita) el código se rechaza con PLANTACION_FINALIZADA, y uno repetido en la
-- organización con CODIGO_DUPLICADO, sin aplicar ningún campo: el cliente corrige
-- el código y reintenta todo.
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

  IF v_cambios ? 'codigo' AND v_actual ->> 'estado' <> 'activa' THEN
    RETURN jsonb_build_object('success', false, 'error', 'PLANTACION_FINALIZADA');
  END IF;

  FOR v_campo IN SELECT jsonb_object_keys(v_cambios) LOOP
    IF v_actual -> v_campo IN (v_base -> v_campo, v_cambios -> v_campo) THEN
      v_aplicar := v_aplicar || jsonb_build_object(v_campo, v_cambios -> v_campo);
    ELSE
      v_conflictos := v_conflictos || conflicto_de_campo(v_actual, v_campo);
    END IF;
  END LOOP;

  BEGIN
    UPDATE plantations SET
      lugar = CASE WHEN v_aplicar ? 'lugar' THEN v_aplicar ->> 'lugar' ELSE lugar END,
      periodo = CASE WHEN v_aplicar ? 'periodo' THEN v_aplicar ->> 'periodo' ELSE periodo END,
      codigo = CASE WHEN v_aplicar ? 'codigo' THEN v_aplicar ->> 'codigo' ELSE codigo END,
      descripcion = CASE WHEN v_aplicar ? 'descripcion' THEN v_aplicar ->> 'descripcion' ELSE descripcion END,
      fecha_inicio = CASE WHEN v_aplicar ? 'fecha_inicio' THEN (v_aplicar ->> 'fecha_inicio')::date ELSE fecha_inicio END,
      objetivo_arboles = CASE WHEN v_aplicar ? 'objetivo_arboles' THEN (v_aplicar ->> 'objetivo_arboles')::integer ELSE objetivo_arboles END,
      gps_capture_frequency = CASE WHEN v_aplicar ? 'gps_capture_frequency' THEN (v_aplicar ->> 'gps_capture_frequency')::integer ELSE gps_capture_frequency END,
      gps_capture_required = CASE WHEN v_aplicar ? 'gps_capture_required' THEN (v_aplicar ->> 'gps_capture_required')::boolean ELSE gps_capture_required END,
      photo_capture_all_trees = CASE WHEN v_aplicar ? 'photo_capture_all_trees' THEN (v_aplicar ->> 'photo_capture_all_trees')::boolean ELSE photo_capture_all_trees END,
      visible_in_app = CASE WHEN v_aplicar ? 'visible_in_app' THEN (v_aplicar ->> 'visible_in_app')::boolean ELSE visible_in_app END
    WHERE id = p_id AND v_aplicar <> '{}';
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'CODIGO_DUPLICADO');
  END;

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
