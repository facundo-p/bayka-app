-- Cambiar la especie de un árbol ya cargado (#679).
--
-- Hasta acá la especie solo cambiaba al resolver un N/N. Dos piezas:
--
-- A. `cambiar_especie_arbol`, para la web: aplica el cambio si el server sigue
--    con la especie que el cliente vio (la base), igual que `editar_plantacion`.
-- B. `sync_subgroup` recibe por árbol `species_base_id`, la especie que el móvil
--    vio en el server. Si el server ya tiene otra, la conserva: sin esto un
--    celular desactualizado revierte lo que se cambió en la web. Un cliente que
--    no manda la base sube la especie como viene, como antes. Suma dos partes a
--    las de 064 y redefine solo la orquestadora.
--
-- Rollback: volver a correr de 064 la orquestadora `sync_subgroup` y
--   DROP FUNCTION IF EXISTS "public"."sync_subgroup_conservar_especies"("jsonb", "jsonb");
--   DROP FUNCTION IF EXISTS "public"."sync_subgroup_conservadas"("jsonb");
--   DROP FUNCTION IF EXISTS "public"."cambiar_especie_arbol"("uuid", "uuid", "uuid");
-- No hay columnas ni datos nuevos que deshacer. En el repo, el rollback borra
-- también el test 43 y saca las partes nuevas del test 45.

-- ── A. cambiar_especie_arbol ─────────────────────────────────────────────────

-- El SubID lleva el código de la especie: se rearma con los códigos vigentes de
-- parcela y grupo, igual que lo arma el móvil.
--
-- Respuesta: `{success: true, sub_id}`, o `{success: false, error}`. Con
-- CONFLICTO_EDICION trae además lo que tiene el server: `species_id`, `codigo`,
-- `nombre` y `sub_id`. Elegir la que el árbol ya tiene es éxito aunque la base sea otra.
CREATE OR REPLACE FUNCTION "public"."cambiar_especie_arbol"("p_tree_id" "uuid", "p_species_id" "uuid", "p_base" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_plantacion UUID;
  v_actual UUID;
  v_motivo TEXT;
  v_sub_id TEXT;
BEGIN
  SELECT g.plantation_id INTO v_plantacion
    FROM trees t JOIN groups g ON g.id = t.group_id
   WHERE t.id = p_tree_id;

  -- Inexistente y ajeno dan lo mismo: no se filtra que el árbol exista.
  IF v_plantacion IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;

  -- FOR SHARE: un archivado o finalizado concurrente espera a este commit.
  PERFORM 1 FROM plantations WHERE id = v_plantacion FOR SHARE;
  -- El gate de editar la plantación: admin de su organización (o superadmin) y
  -- plantación escribible. El móvil cambia la especie por `sync_subgroup`.
  v_motivo := rechazo_configuracion_plantacion(v_plantacion, plantacion_escribible(v_plantacion));
  IF v_motivo IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_motivo);
  END IF;

  -- El árbol antes que plantation_species, en el mismo orden que `sync_subgroup`:
  -- al revés, un push concurrente del mismo árbol se traba con este cambio.
  SELECT species_id, sub_id INTO v_actual, v_sub_id FROM trees WHERE id = p_tree_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;

  -- FOR SHARE: una baja concurrente de la especie espera, y su trigger (055) ve
  -- este árbol.
  PERFORM 1 FROM plantation_species
   WHERE plantation_id = v_plantacion AND species_id = p_species_id
     FOR SHARE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ESPECIE_NO_HABILITADA');
  END IF;

  IF v_actual IS DISTINCT FROM p_base AND v_actual IS DISTINCT FROM p_species_id THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'CONFLICTO_EDICION',
      'species_id', v_actual,
      'codigo', (SELECT codigo FROM species WHERE id = v_actual),
      'nombre', (SELECT nombre FROM species WHERE id = v_actual),
      'sub_id', v_sub_id
    );
  END IF;

  UPDATE trees t
     SET species_id = p_species_id,
         sub_id = p.codigo || g.codigo || s.codigo || t.posicion
    FROM groups g, parcelas p, species s
   WHERE t.id = p_tree_id
     AND g.id = t.group_id
     AND p.id = g.parcela_id
     AND s.id = p_species_id
  RETURNING t.sub_id INTO v_sub_id;

  RETURN jsonb_build_object('success', true, 'sub_id', v_sub_id);
END;
$$;

ALTER FUNCTION "public"."cambiar_especie_arbol"("uuid", "uuid", "uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."cambiar_especie_arbol"("uuid", "uuid", "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."cambiar_especie_arbol"("uuid", "uuid", "uuid") TO "authenticated", "service_role";

-- ── B. sync_subgroup no pisa una especie más nueva del server ────────────────

-- Los árboles a subir, con la especie del server donde difiere de la base que vio
-- el móvil, y el SubID rearmado con su código; `upsert_arboles` lo pasa después
-- al código de parcela vigente. Un N/N del server nunca se conserva: nadie cambia
-- un árbol a N/N, así que es uno sin resolver. Sin `species_base_id` (un móvil
-- viejo) no se conserva nada. FOR UPDATE antes de leer la especie del server: un
-- `cambiar_especie_arbol` concurrente no queda en el medio.
CREATE OR REPLACE FUNCTION "public"."sync_subgroup_conservar_especies"("p_subgroup" "jsonb", "p_trees" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM 1 FROM trees
   WHERE id IN (SELECT (t->>'id')::UUID FROM jsonb_array_elements(p_trees) AS t)
     FOR UPDATE;

  RETURN (
    SELECT coalesce(jsonb_agg(
             CASE WHEN t ? 'species_base_id'
                   AND actual.species_id IS NOT NULL
                   AND actual.species_id IS DISTINCT FROM NULLIF(t->>'species_base_id', '')::UUID
                  THEN t || jsonb_build_object(
                         'species_id', actual.species_id,
                         'sub_id', (p_subgroup->>'parcela_codigo') || (p_subgroup->>'codigo')
                                   || s.codigo || (t->>'posicion')::INTEGER)
                  ELSE t END
             ORDER BY e.orden), '[]')
      FROM jsonb_array_elements(p_trees) WITH ORDINALITY AS e(t, orden)
      LEFT JOIN trees actual ON actual.id = (t->>'id')::UUID
      LEFT JOIN species s ON s.id = actual.species_id
  );
END;
$$;

ALTER FUNCTION "public"."sync_subgroup_conservar_especies"("jsonb", "jsonb") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."sync_subgroup_conservar_especies"("jsonb", "jsonb") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."sync_subgroup_conservar_especies"("jsonb", "jsonb") TO "service_role";

-- Los árboles que quedaron con otra especie que la que mandó el móvil: la del
-- server, conservada ({id, species_id}). El móvil la adopta en todos, también en
-- los que no tocó (un grupo que llega pendiente a cada sync no la recibe por el
-- pull), y avisa solo de los que había cambiado. Si el móvil mandó una especie,
-- la final nunca es N/N.
CREATE OR REPLACE FUNCTION "public"."sync_subgroup_conservadas"("p_trees" "jsonb") RETURNS "jsonb"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', tr.id, 'species_id', tr.species_id) ORDER BY tr.id), '[]')
    FROM jsonb_array_elements(p_trees) AS t
    JOIN trees tr ON tr.id = (t->>'id')::UUID
   WHERE tr.species_id IS DISTINCT FROM NULLIF(t->>'species_id', '')::UUID;
$$;

ALTER FUNCTION "public"."sync_subgroup_conservadas"("jsonb") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."sync_subgroup_conservadas"("jsonb") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."sync_subgroup_conservadas"("jsonb") TO "service_role";

-- Árboles y especies a habilitar salen del payload ya con las especies conservadas.
CREATE OR REPLACE FUNCTION "public"."sync_subgroup"("p_subgroup" "jsonb", "p_trees" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_rechazo TEXT;
  v_parcela_codigo TEXT;
  v_arboles JSONB;
BEGIN
  v_rechazo := sync_subgroup_rechazo(p_subgroup);
  IF v_rechazo IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_rechazo);
  END IF;

  -- Locks en este orden: grupo → parcela → árboles → plantation_species. Otra
  -- escritura que tome más de uno tiene que seguirlo, o se pueden trabar.
  PERFORM sync_subgroup_upsert_grupo(p_subgroup);
  v_parcela_codigo := sync_subgroup_codigo_parcela(p_subgroup);
  v_arboles := sync_subgroup_conservar_especies(p_subgroup, p_trees);
  PERFORM sync_subgroup_upsert_arboles(p_subgroup, v_arboles, v_parcela_codigo);
  PERFORM sync_subgroup_habilitar_especies(p_subgroup, v_arboles);

  RETURN jsonb_build_object('success', true, 'conservadas', sync_subgroup_conservadas(p_trees));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'UNKNOWN');
END;
$$;
