-- Reabrir una plantación finalizada, solo superadmin (#470).
--
-- #469 dejó la finalizada inmutable desde la app, y eso deja un caso sin salida:
-- un técnico termina un grupo sin señal, el admin finaliza sin verlo —su gate lee
-- su propio SQLite—, y cuando el técnico recupera señal su push se rechaza. El
-- trabajo queda atrapado en el celular. Esta es la válvula de escape.
--
-- No habilita una capacidad nueva en el server: `puede_editar_finalizada()` (037)
-- ya deja a un superadmin activo pasar el `USING` de `Admin can update plantations`,
-- así que hoy podría reabrir con un UPDATE crudo por PostgREST. Lo que agrega es
-- el gate explícito y la validación del estado previo, que un UPDATE no hace.
--
-- Los grupos NO se tocan: cada uno conserva su estado. Reabrir devuelve la
-- capacidad de trabajar; no deshace las finalizaciones de grupo.

-- Idempotente: reabrir una activa no es un error, no cambia nada. Archivada sí
-- rechaza — desarchivar primero, que es una decisión aparte.
CREATE OR REPLACE FUNCTION "public"."reabrir_plantacion"("p_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_archivada TIMESTAMPTZ;
BEGIN
  -- Inexistente y ajena dan lo mismo: no se filtra que la plantación exista.
  IF NOT (is_superadmin() AND plantacion_de_mi_organizacion(p_id)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;

  -- Bloquea la fila contra un archivado concurrente, igual que los demás RPC.
  SELECT archivada_en INTO v_archivada FROM plantations WHERE id = p_id FOR UPDATE;

  IF v_archivada IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PLANTACION_ARCHIVADA');
  END IF;

  UPDATE plantations SET estado = 'activa' WHERE id = p_id AND estado = 'finalizada';

  RETURN jsonb_build_object('success', true);
END;
$$;

ALTER FUNCTION "public"."reabrir_plantacion"("uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."reabrir_plantacion"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."reabrir_plantacion"("uuid") TO "authenticated", "service_role";
