-- El SubID de un árbol arranca con el código de su parcela (#623). Cambiar el
-- código dejaba los árboles con el prefijo viejo, en el server y en los demás
-- dispositivos. El server los reescribe acá, en la misma transacción que el
-- UPDATE de la parcela, así el móvil que hizo el cambio no tiene que re-subir
-- grupos enteros: `sync_subgroup` hace upsert completo y pisaría el estado o la
-- especie que otro técnico cargó en esos grupos.
--
-- SECURITY DEFINER: el UPDATE de la parcela ya pasó su policy, que exige lo
-- mismo que la de `trees` (miembro + plantación escribible, 037). Con RLS el
-- trigger podría saltearse filas en silencio y dejar la parcela a medias.
--
-- `trees` no tiene `updated_at`: el pull del móvil baja todos los árboles de la
-- plantación, sin watermark, así que no hay columna que tocar para que lo vea.

CREATE OR REPLACE FUNCTION "public"."reescribir_subid_por_codigo_de_parcela"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Filtra por parcela + grupo: con solo el código de parcela, un `P10L1…`
  -- desactualizado en una parcela `P1` terminaría en `P90L1…`. Si el código del
  -- grupo en el server quedó viejo (#626) el árbol no calza y no se toca: dejarlo
  -- como está es mejor que reescribirlo mal.
  UPDATE trees t
     SET sub_id = NEW.codigo || substr(t.sub_id, length(OLD.codigo) + 1)
    FROM groups g
   WHERE g.id = t.group_id
     AND g.parcela_id = NEW.id
     AND starts_with(t.sub_id, OLD.codigo || g.codigo);
  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."reescribir_subid_por_codigo_de_parcela"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "trg_subid_sigue_al_codigo_de_parcela" ON "public"."parcelas";
CREATE TRIGGER "trg_subid_sigue_al_codigo_de_parcela"
  AFTER UPDATE OF "codigo" ON "public"."parcelas"
  FOR EACH ROW
  WHEN (OLD."codigo" IS DISTINCT FROM NEW."codigo")
  EXECUTE FUNCTION "public"."reescribir_subid_por_codigo_de_parcela"();
