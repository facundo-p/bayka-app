-- Eliminar plantaciones de verdad (#478).
--
-- Sin datos (ningún grupo ni árbol): la borra un admin o superadmin activo de la
-- organización. Con datos: solo superadmin, solo si ya está archivada y
-- escribiendo el nombre. Parcelas, especies y técnicos asignados son
-- configuración y no cuentan como datos.
--
-- El borrado es un DELETE real con cascade. Las fotos de Storage las borra la
-- edge function `admin-plantaciones` después, con service_role.

-- ── A. Registro de eliminadas ────────────────────────────────────────────────

-- Auditoría y, además, lo que le permite a mobile distinguir "eliminada" de
-- "sin acceso": una vez borrada no queda ninguna otra huella de la plantación.
CREATE TABLE IF NOT EXISTS "public"."plantaciones_eliminadas" (
  "id" "uuid" PRIMARY KEY,
  "organizacion_id" "uuid" NOT NULL REFERENCES "public"."organizations"("id"),
  "nombre" "text" NOT NULL,
  "eliminada_por" "uuid" REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "eliminada_en" timestamp with time zone NOT NULL DEFAULT "now"(),
  "resumen" "jsonb" NOT NULL DEFAULT '{}'::"jsonb",
  "fotos_limpias" boolean NOT NULL DEFAULT false
);

ALTER TABLE "public"."plantaciones_eliminadas" OWNER TO "postgres";
ALTER TABLE "public"."plantaciones_eliminadas" ENABLE ROW LEVEL SECURITY;

-- Solo se escribe desde `eliminar_plantacion` (definer) y la edge function
-- (service_role). Los clientes la consultan a través de los RPC.
REVOKE ALL ON TABLE "public"."plantaciones_eliminadas" FROM PUBLIC, "anon", "authenticated";
GRANT ALL ON TABLE "public"."plantaciones_eliminadas" TO "service_role";

CREATE INDEX IF NOT EXISTS "plantaciones_eliminadas_fotos_pendientes_idx"
  ON "public"."plantaciones_eliminadas" ("organizacion_id")
  WHERE NOT "fotos_limpias";

-- ── B. Conteos ───────────────────────────────────────────────────────────────

-- Lo que se pierde al borrar. `tiene_datos` = algún grupo o algún árbol; como
-- todo árbol cuelga de un grupo (trees.group_id NOT NULL), alcanza con los grupos.
CREATE OR REPLACE FUNCTION "public"."resumen_eliminacion_plantacion"("p_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT jsonb_build_object(
    'lugar', p.lugar,
    'periodo', p.periodo,
    'parcelas', (SELECT count(*) FROM parcelas pa WHERE pa.plantation_id = p.id AND pa.deleted_at IS NULL),
    'grupos', (SELECT count(*) FROM groups g WHERE g.plantation_id = p.id),
    'arboles', (SELECT count(*) FROM trees t JOIN groups g ON g.id = t.group_id WHERE g.plantation_id = p.id),
    'arboles_con_foto', (SELECT count(*) FROM trees t JOIN groups g ON g.id = t.group_id
                         WHERE g.plantation_id = p.id AND t.foto_url IS NOT NULL),
    'tiene_datos', EXISTS (SELECT 1 FROM groups g WHERE g.plantation_id = p.id)
  )
  FROM plantations p
  WHERE p.id = p_id;
$$;

ALTER FUNCTION "public"."resumen_eliminacion_plantacion"("uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."resumen_eliminacion_plantacion"("uuid") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."resumen_eliminacion_plantacion"("uuid") TO "service_role";

-- NULL = se puede borrar (con datos, falta además el nombre). Mismo orden de
-- chequeo que `eliminar_plantacion`.
CREATE OR REPLACE FUNCTION "public"."motivo_no_eliminable"("p_id" "uuid", "p_tiene_datos" boolean) RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN NOT p_tiene_datos THEN NULL
    WHEN NOT EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND activo AND rol = 'superadmin'
    ) THEN 'REQUIERE_SUPERADMIN'
    WHEN (SELECT archivada_en FROM plantations WHERE id = p_id) IS NULL THEN 'REQUIERE_ARCHIVAR'
  END;
$$;

ALTER FUNCTION "public"."motivo_no_eliminable"("uuid", boolean) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."motivo_no_eliminable"("uuid", boolean) FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."motivo_no_eliminable"("uuid", boolean) TO "service_role";

-- ── C. Previsualizar ─────────────────────────────────────────────────────────

-- Lo usa el modal de la web para decidir qué ofrecer. Mismo guard que archivar:
-- admin o superadmin activo de la organización de la plantación.
CREATE OR REPLACE FUNCTION "public"."previsualizar_eliminacion_plantacion"("p_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_resumen JSONB;
  v_motivo TEXT;
BEGIN
  IF NOT puede_archivar_plantacion(p_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;

  v_resumen := resumen_eliminacion_plantacion(p_id);
  v_motivo := motivo_no_eliminable(p_id, (v_resumen->>'tiene_datos')::boolean);

  RETURN v_resumen || jsonb_build_object(
    'success', true,
    'puede', v_motivo IS NULL,
    'motivo', v_motivo
  );
END;
$$;

ALTER FUNCTION "public"."previsualizar_eliminacion_plantacion"("uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."previsualizar_eliminacion_plantacion"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."previsualizar_eliminacion_plantacion"("uuid") TO "authenticated", "service_role";

-- ── D. Eliminar ──────────────────────────────────────────────────────────────

-- El FOR UPDATE serializa contra un `sync_subgroup` concurrente: insertar un
-- grupo toma un lock de la FK sobre la plantación. Si el grupo entra antes, el
-- conteo lo ve y el borrado exige las reglas "con datos"; si el borrado entra
-- antes, el push falla porque la plantación ya no existe.
CREATE OR REPLACE FUNCTION "public"."eliminar_plantacion"("p_id" "uuid", "p_nombre_confirmacion" "text" DEFAULT NULL) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_plantacion plantations%ROWTYPE;
  v_resumen JSONB;
  v_motivo TEXT;
BEGIN
  SELECT * INTO v_plantacion FROM plantations WHERE id = p_id FOR UPDATE;

  -- Inexistente o de otra organización responden igual: no se filtra su existencia.
  IF NOT FOUND OR NOT puede_archivar_plantacion(p_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;

  v_resumen := resumen_eliminacion_plantacion(p_id);
  v_motivo := motivo_no_eliminable(p_id, (v_resumen->>'tiene_datos')::boolean);
  IF v_motivo IS NULL AND (v_resumen->>'tiene_datos')::boolean
     AND trim(coalesce(p_nombre_confirmacion, '')) <> trim(v_plantacion.lugar) THEN
    v_motivo := 'NOMBRE_NO_COINCIDE';
  END IF;
  IF v_motivo IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_motivo);
  END IF;

  INSERT INTO plantaciones_eliminadas (id, organizacion_id, nombre, eliminada_por, resumen)
  VALUES (p_id, v_plantacion.organizacion_id, v_plantacion.lugar, auth.uid(), v_resumen);

  -- Cascade: parcelas, groups (y sus trees), plantation_species, plantation_users.
  DELETE FROM plantations WHERE id = p_id;

  RETURN jsonb_build_object('success', true, 'resumen', v_resumen);
END;
$$;

ALTER FUNCTION "public"."eliminar_plantacion"("uuid", "text") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."eliminar_plantacion"("uuid", "text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."eliminar_plantacion"("uuid", "text") TO "authenticated", "service_role";

-- ── E. Estado remoto para mobile ─────────────────────────────────────────────

-- Una fila por id recibido. `ok`/`archivada` exigen membresía, como las policies
-- de SELECT. `eliminada` solo se informa dentro de la organización del usuario;
-- cualquier otro caso (sin membresía, inexistente, de otra organización) es
-- `sin_acceso`.
CREATE OR REPLACE FUNCTION "public"."estado_remoto_plantaciones"("p_ids" "uuid"[])
RETURNS TABLE ("id" "uuid", "estado" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT pedido.id,
    CASE
      WHEN p.id IS NOT NULL AND is_plantation_member(p.id) THEN
        CASE WHEN p.archivada_en IS NULL THEN 'ok' ELSE 'archivada' END
      WHEN p.id IS NULL AND EXISTS (
        SELECT 1 FROM plantaciones_eliminadas e
        WHERE e.id = pedido.id AND e.organizacion_id = current_organizacion_id()
      ) THEN 'eliminada'
      ELSE 'sin_acceso'
    END
  FROM unnest(p_ids) AS pedido(id)
  LEFT JOIN plantations p ON p.id = pedido.id;
$$;

ALTER FUNCTION "public"."estado_remoto_plantaciones"("uuid"[]) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."estado_remoto_plantaciones"("uuid"[]) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."estado_remoto_plantaciones"("uuid"[]) TO "authenticated", "service_role";
