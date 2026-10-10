-- `stats_plantaciones` cuenta puntos GPS y fotos, y lista los técnicos (#826).
--
-- El listado web de plantaciones reemplaza las columnas Usuarios y Visible por
-- Puntos GPS y Fotos, y filtra por técnico asignado. `usuarios` se va: contaba
-- también a los admins, que son miembros automáticos de todas.
--
-- Cambiar el tipo de retorno obliga a DROP + CREATE. La web anterior lee
-- `usuarios` y la ve vacía hasta que se deploya la nueva.
--
-- Rollback: DROP FUNCTION stats_plantaciones() y recrearla como en la baseline;
-- `dashboard_arboles` puede quedar con `foto_subida`. En el repo, el rollback
-- borra también el test 61.

-- ── Foto subida ──────────────────────────────────────────────────────────────

-- Una foto con esquema local (file://, content://) todavía no se subió: espejo de
-- ESQUEMAS_FOTO_LOCAL de la web. La comparten el dashboard y el listado para que
-- cuenten lo mismo.
-- Sin `SET search_path`: con SET, Postgres no la inlinea y la llama fila a fila
-- (40x más lenta sobre 1M de árboles). Solo usa operadores de pg_catalog.
CREATE OR REPLACE FUNCTION "public"."foto_subida"("p_foto_url" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT coalesce(p_foto_url, '') <> ''
    AND p_foto_url NOT LIKE 'file://%'
    AND p_foto_url NOT LIKE 'content://%';
$$;

ALTER FUNCTION "public"."foto_subida"("text") OWNER TO "postgres";

-- Igual que en 068, con el predicado extraído.
CREATE OR REPLACE FUNCTION "public"."dashboard_arboles"("p_plantation_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY INVOKER
    SET "search_path" TO 'public'
    AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'parcela_id', parcela_id,
    'species_id', species_id,
    'mes', mes,
    'con_gps', con_gps,
    'con_foto', con_foto,
    'cantidad', cantidad
  )), '[]'::jsonb)
  FROM (
    SELECT
      g.parcela_id,
      t.species_id,
      to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM') AS mes,
      t.latitude IS NOT NULL AS con_gps,
      foto_subida(t.foto_url) AS con_foto,
      count(*) AS cantidad
    FROM trees t
    JOIN groups g ON g.id = t.group_id
    WHERE g.plantation_id = p_plantation_id
    GROUP BY 1, 2, 3, 4, 5
  ) conteos;
$$;

-- ── Listado de plantaciones ──────────────────────────────────────────────────

DROP FUNCTION IF EXISTS "public"."stats_plantaciones"();

-- SECURITY INVOKER: la RLS deja solo las plantaciones de las que el usuario es
-- miembro. `tecnicos` excluye a los admins, que ven todas.
CREATE FUNCTION "public"."stats_plantaciones"()
    RETURNS TABLE(
      "plantation_id" "uuid",
      "arboles" bigint,
      "parcelas" bigint,
      "puntos_gps" bigint,
      "fotos" bigint,
      "tecnicos" "uuid"[]
    )
    LANGUAGE "sql" STABLE SECURITY INVOKER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    p.id,
    a.arboles,
    (SELECT count(*) FROM parcelas pa
      WHERE pa.plantation_id = p.id AND pa.deleted_at IS NULL),
    a.puntos_gps,
    a.fotos,
    (SELECT coalesce(array_agg(pu.user_id ORDER BY pu.user_id), '{}')
      FROM plantation_users pu
      WHERE pu.plantation_id = p.id AND pu.rol_en_plantacion = 'tecnico')
  FROM plantations p
  LEFT JOIN LATERAL (
    SELECT
      count(*) AS arboles,
      count(*) FILTER (WHERE t.latitude IS NOT NULL) AS puntos_gps,
      count(*) FILTER (WHERE foto_subida(t.foto_url)) AS fotos
    FROM trees t
    JOIN groups g ON g.id = t.group_id
    WHERE g.plantation_id = p.id
  ) a ON true;
$$;

ALTER FUNCTION "public"."stats_plantaciones"() OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."stats_plantaciones"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."stats_plantaciones"() TO "authenticated", "service_role";
