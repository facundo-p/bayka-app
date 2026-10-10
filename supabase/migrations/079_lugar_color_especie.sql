-- Lugar de color fijo de cada especie en su plantación (#845).
--
-- La web tomaba el color de la posición de la especie en el catálogo de la
-- plantación ordenado por código: habilitar o quitar una cambiaba el color de
-- todas las que venían después. Ahora cada fila guarda su lugar en la paleta, y
-- la web pinta `paleta[lugar % 12]`.
--
-- A. Columna, relleno con el orden de hoy (así ningún color cambia) e índice
--    único por plantación.
-- B. Trigger: la especie que se habilita toma el menor lugar libre de su
--    plantación. Cubre `aplicar_cambios_especies`, el alta automática de
--    `sync_subgroup` y el insert directo. Quitarla libera el lugar. Los demás
--    escritores hacen upsert o update, así que una especie que sigue habilitada
--    conserva su lugar.
-- C. `aplicar_cambios_especies` quita antes de habilitar: en un mismo cambio,
--    la especie nueva toma el lugar que liberó la quitada. Ella y
--    `reemplazar_especies_plantacion` toman el lock de los lugares antes de
--    borrar, en el mismo orden que `sync_subgroup`.
--
-- N/N no ocupa lugar: se pinta en ámbar. Su código es el sentinela de
-- contracts/species-sentinel.json.
--
-- Rollback: DROP TRIGGER trg_asignar_lugar_color ON plantation_species; DROP
-- INDEX plantation_species_lugar_color_key; ALTER TABLE plantation_species DROP
-- COLUMN lugar_color; recrear aplicar_cambios_especies como en 058 y
-- reemplazar_especies_plantacion como en 055; DROP FUNCTION de
-- asignar_lugar_color(), menor_lugar_color_libre(uuid),
-- bloquear_lugares_color(uuid), rellenar_lugares_color() y
-- ocupa_lugar_color(uuid).

-- ── A. Columna, relleno e índice ─────────────────────────────────────────────

ALTER TABLE "public"."plantation_species"
  ADD COLUMN IF NOT EXISTS "lugar_color" integer
  CONSTRAINT "plantation_species_lugar_color_check" CHECK ("lugar_color" >= 0);

CREATE OR REPLACE FUNCTION "public"."ocupa_lugar_color"("p_especie" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM species WHERE id = p_especie AND codigo <> 'NN');
$$;

ALTER FUNCTION "public"."ocupa_lugar_color"("uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."ocupa_lugar_color"("uuid") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."ocupa_lugar_color"("uuid") TO "service_role";

-- Solo plantaciones sin ningún lugar asignado: volver a correrlo no reordena
-- los colores de una plantación que ya los tiene. `COLLATE "C"` es el orden del
-- `.sort()` de JS que usaba la web.
CREATE OR REPLACE FUNCTION "public"."rellenar_lugares_color"() RETURNS void
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  UPDATE plantation_species ps SET lugar_color = o.lugar
  FROM (
    SELECT ps2.plantation_id, ps2.species_id,
           (row_number() OVER (PARTITION BY ps2.plantation_id ORDER BY s.codigo COLLATE "C") - 1)::INTEGER AS lugar
    FROM plantation_species ps2 JOIN species s ON s.id = ps2.species_id
    WHERE ocupa_lugar_color(ps2.species_id)
      AND NOT EXISTS (
        SELECT 1 FROM plantation_species asignada
        WHERE asignada.plantation_id = ps2.plantation_id AND asignada.lugar_color IS NOT NULL
      )
  ) o
  WHERE ps.plantation_id = o.plantation_id
    AND ps.species_id = o.species_id;
$$;

ALTER FUNCTION "public"."rellenar_lugares_color"() OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."rellenar_lugares_color"() FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."rellenar_lugares_color"() TO "service_role";

SELECT "public"."rellenar_lugares_color"();

CREATE UNIQUE INDEX IF NOT EXISTS "plantation_species_lugar_color_key"
  ON "public"."plantation_species" USING btree ("plantation_id", "lugar_color");

-- ── B. Alta: menor lugar libre ───────────────────────────────────────────────

-- Dos altas simultáneas en la misma plantación calcularían el mismo lugar y la
-- segunda chocaría con el índice: el lock las pone en fila hasta el commit.
CREATE OR REPLACE FUNCTION "public"."bloquear_lugares_color"("p_plantacion" "uuid") RETURNS void
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('lugar_color'), hashtext(p_plantacion::TEXT));
END;
$$;

ALTER FUNCTION "public"."bloquear_lugares_color"("uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."bloquear_lugares_color"("uuid") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."bloquear_lugares_color"("uuid") TO "service_role";

-- Entre 0 y la cantidad de filas siempre hay uno libre.
CREATE OR REPLACE FUNCTION "public"."menor_lugar_color_libre"("p_plantacion" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT min(candidato)::INTEGER
  FROM generate_series(0, (SELECT count(*) FROM plantation_species WHERE plantation_id = p_plantacion)) AS candidato
  WHERE NOT EXISTS (
    SELECT 1 FROM plantation_species
    WHERE plantation_id = p_plantacion AND lugar_color = candidato
  );
$$;

ALTER FUNCTION "public"."menor_lugar_color_libre"("uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."menor_lugar_color_libre"("uuid") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."menor_lugar_color_libre"("uuid") TO "service_role";

-- El lugar lo asigna siempre el server: un cliente que reinserta una fila leída
-- antes no arrastra un lugar que ya ocupó otra especie. En un upsert que choca
-- con la fila existente el valor se descarta y la fila conserva el suyo.
CREATE OR REPLACE FUNCTION "public"."asignar_lugar_color"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.lugar_color := NULL;
  IF ocupa_lugar_color(NEW.species_id) THEN
    PERFORM bloquear_lugares_color(NEW.plantation_id);
    NEW.lugar_color := menor_lugar_color_libre(NEW.plantation_id);
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."asignar_lugar_color"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "trg_asignar_lugar_color" ON "public"."plantation_species";
CREATE TRIGGER "trg_asignar_lugar_color"
  BEFORE INSERT ON "public"."plantation_species"
  FOR EACH ROW EXECUTE FUNCTION "public"."asignar_lugar_color"();

-- ── C. Altas y bajas: primero las bajas ──────────────────────────────────────

-- Igual a 058 salvo el lock y el orden: las bajas antes que las altas, y las
-- altas por código como el relleno. El lock va antes del DELETE para que el
-- orden sea el de `sync_subgroup` (lugares → filas de plantation_species); si
-- no, las dos se pueden trabar.
CREATE OR REPLACE FUNCTION "public"."aplicar_cambios_especies"("p_plantacion" "uuid", "p_altas" "uuid"[], "p_bajas" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_altas UUID[] := coalesce(p_altas, '{}');
  v_bajas UUID[] := coalesce(p_bajas, '{}');
  v_rechazo TEXT;
  v_rechazadas JSONB := '[]';
  v_especie UUID;
BEGIN
  PERFORM 1 FROM plantations WHERE id = p_plantacion FOR SHARE;

  v_rechazo := rechazo_configuracion_plantacion(p_plantacion, plantacion_escribible(p_plantacion));
  IF v_rechazo IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_rechazo);
  END IF;

  SELECT v_rechazadas || coalesce(jsonb_agg(jsonb_build_object('species_id', a.id, 'error', 'ESPECIE_INEXISTENTE')), '[]')
    INTO v_rechazadas
    FROM unnest(v_altas) AS a(id)
   WHERE NOT EXISTS (SELECT 1 FROM species s WHERE s.id = a.id);

  PERFORM bloquear_lugares_color(p_plantacion);

  FOR v_especie IN SELECT DISTINCT b.id FROM unnest(v_bajas) AS b(id) WHERE NOT (b.id = ANY (v_altas)) LOOP
    -- El trigger de 055 frena el DELETE si la especie tiene árboles, también uno
    -- que entró recién: el bloque deshace solo esta baja.
    BEGIN
      DELETE FROM plantation_species WHERE plantation_id = p_plantacion AND species_id = v_especie;
    EXCEPTION WHEN restrict_violation THEN
      v_rechazadas := v_rechazadas || jsonb_build_object('species_id', v_especie, 'error', 'ESPECIE_CON_ARBOLES');
    END;
  END LOOP;

  INSERT INTO plantation_species (plantation_id, species_id, orden_visual)
  SELECT p_plantacion, s.id, 0
    FROM species s
   WHERE s.id = ANY (v_altas)
   ORDER BY s.codigo COLLATE "C"
  ON CONFLICT (plantation_id, species_id) DO NOTHING;

  PERFORM ordenar_especies_plantacion(p_plantacion);

  RETURN jsonb_build_object('success', true, 'rechazadas', v_rechazadas);
END;
$$;

ALTER FUNCTION "public"."aplicar_cambios_especies"("uuid", "uuid"[], "uuid"[]) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."aplicar_cambios_especies"("uuid", "uuid"[], "uuid"[]) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."aplicar_cambios_especies"("uuid", "uuid"[], "uuid"[]) TO "authenticated", "service_role";

-- Igual a 055 salvo el lock antes del DELETE, por el mismo motivo. Ningún
-- cliente actual la llama, pero un APK viejo sí puede.
CREATE OR REPLACE FUNCTION "public"."reemplazar_especies_plantacion"("p_plantacion" "uuid", "p_especies" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_especies JSONB := coalesce(p_especies, '[]');
  v_ids UUID[];
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

  SELECT coalesce(array_agg((e.valor->>'species_id')::UUID), '{}')
    INTO v_ids FROM jsonb_array_elements(v_especies) AS e(valor);

  IF EXISTS (
    SELECT 1 FROM plantation_species ps
    WHERE ps.plantation_id = p_plantacion
      AND NOT (ps.species_id = ANY (v_ids))
      AND especie_tiene_arboles(p_plantacion, ps.species_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ESPECIE_CON_ARBOLES');
  END IF;

  PERFORM bloquear_lugares_color(p_plantacion);

  -- Un árbol que entra entre el chequeo y el DELETE lo frena el trigger: mismo rechazo.
  BEGIN
    DELETE FROM plantation_species
    WHERE plantation_id = p_plantacion AND NOT (species_id = ANY (v_ids));
  EXCEPTION WHEN restrict_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'ESPECIE_CON_ARBOLES');
  END;

  INSERT INTO plantation_species (plantation_id, species_id, orden_visual)
  SELECT p_plantacion, (e.valor->>'species_id')::UUID, coalesce((e.valor->>'orden_visual')::INTEGER, 0)
  FROM jsonb_array_elements(v_especies) AS e(valor)
  ON CONFLICT (plantation_id, species_id) DO UPDATE SET orden_visual = EXCLUDED.orden_visual;

  RETURN jsonb_build_object('success', true);
END;
$$;
