-- Quitar la foto de un árbol ya sincronizado no llegaba al server (#498):
-- `sync_subgroup` hace `COALESCE(EXCLUDED.foto_url, trees.foto_url)`, así que un
-- null nunca borra, y el pull siguiente restauraba la foto en el device.
--
-- RPC propio y no un tipo más de `sincronizar_borrados`: la fila no se borra, y
-- redefinir ese RPC acá pisaría las versiones que traen otras migraciones.
--
-- Devuelve los ids rechazados y no un contador, por lo mismo que 037: un id que ya
-- no está en el server tampoco se actualiza, y ése el cliente sí lo tiene que
-- limpiar.
--
-- El objeto de Storage NO se borra: la policy de DELETE exige admin y un técnico
-- no podría, y borrar la fila de `storage.objects` desde SQL no borra el archivo.
-- Queda huérfano hasta que se suba otra foto (mismo path, upsert) o se limpie
-- aparte.
CREATE OR REPLACE FUNCTION "public"."quitar_fotos_arboles"("p_arboles" "uuid"[])
RETURNS "jsonb"
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_quitadas INT := 0;
  v_rechazados UUID[] := '{}';
BEGIN
  -- Rechazados = los que EXISTEN en una plantación no escribible: quedan
  -- pendientes en el device por si se reabre. Mismo criterio que 037.
  SELECT COALESCE(array_agg(t.id), '{}') INTO v_rechazados
  FROM trees t JOIN groups g ON g.id = t.group_id
  WHERE t.id = ANY(p_arboles)
    AND NOT plantacion_escribible(g.plantation_id);

  -- Membresía y estado contra la plantación REAL de cada fila, no la del payload.
  UPDATE trees t
  SET foto_url = NULL
  FROM groups g
  WHERE t.id = ANY(p_arboles)
    AND g.id = t.group_id
    AND t.foto_url IS NOT NULL
    AND is_plantation_member(g.plantation_id)
    AND plantacion_escribible(g.plantation_id);
  GET DIAGNOSTICS v_quitadas = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'quitadas', v_quitadas,
    'rechazados', to_jsonb(v_rechazados)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

ALTER FUNCTION "public"."quitar_fotos_arboles"("uuid"[]) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."quitar_fotos_arboles"("uuid"[]) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."quitar_fotos_arboles"("uuid"[]) TO "authenticated", "service_role";
