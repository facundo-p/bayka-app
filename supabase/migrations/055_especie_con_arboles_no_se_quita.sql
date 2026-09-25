-- Una especie con árboles no se puede quitar de su plantación (#632).
--
-- Hasta acá lo impedía solo la pantalla. Quitarla deja árboles cuya especie ya no
-- tiene botón y que la exportación y los conteos por especie dejan de ver bien.
--
-- A. El trigger es la red para cualquier DELETE (policy de admin o RPC).
-- B. `reemplazar_especies_plantacion` deja de borrar y reinsertar todo: con el
--    trigger, eso rechazaría hasta un reemplazo que conserva la especie. Ahora quita
--    solo las ausentes, y avisa con `ESPECIE_CON_ARBOLES` antes de intentarlo.

-- ── A. Guard ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION "public"."especie_tiene_arboles"("p_plantacion" "uuid", "p_especie" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM trees t JOIN groups g ON g.id = t.group_id
    WHERE g.plantation_id = p_plantacion AND t.species_id = p_especie
  );
$$;

ALTER FUNCTION "public"."especie_tiene_arboles"("uuid", "uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."especie_tiene_arboles"("uuid", "uuid") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."especie_tiene_arboles"("uuid", "uuid") TO "service_role";

-- En el cascade de un borrado de plantación la fila padre ya no está: ahí se deja pasar.
CREATE OR REPLACE FUNCTION "public"."no_quitar_especie_con_arboles"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM plantations WHERE id = OLD.plantation_id)
     AND especie_tiene_arboles(OLD.plantation_id, OLD.species_id) THEN
    RAISE EXCEPTION 'ESPECIE_CON_ARBOLES' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$$;

ALTER FUNCTION "public"."no_quitar_especie_con_arboles"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "trg_no_quitar_especie_con_arboles" ON "public"."plantation_species";
CREATE TRIGGER "trg_no_quitar_especie_con_arboles"
  BEFORE DELETE ON "public"."plantation_species"
  FOR EACH ROW EXECUTE FUNCTION "public"."no_quitar_especie_con_arboles"();

-- ── B. Reemplazo que conserva las especies que siguen ────────────────────────

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
