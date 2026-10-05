-- El dashboard y el explorador de datos de la web cuentan en el server (#684).
--
-- Antes bajaban todos los árboles de la plantación, en páginas de 1000 en
-- serie, para contarlos en el navegador; el explorador además hacía dos counts
-- por parcela. Ahora cada uno es un solo RPC con GROUP BY.
--
-- Devuelven jsonb y no TABLE: PostgREST corta en 1000 filas cualquier RPC que
-- devuelva un conjunto, y estos crecen con parcelas, especies, meses y grupos.
--
-- SECURITY INVOKER: cuentan solo lo que el usuario puede leer, igual que las
-- lecturas que reemplazan.
--
-- Rollback: DROP FUNCTION dashboard_arboles(uuid) y arboles_por_grupo(uuid). Una
-- web que ya los use deja de cargar el dashboard y el explorador. En el repo, el
-- rollback borra también el test 50.

-- ── Dashboard ────────────────────────────────────────────────────────────────

-- Árboles agrupados por parcela, especie, mes de registro (UTC), GPS y foto. El
-- cliente suma estas filas para los KPIs y las distribuciones, y filtra por
-- parcela sin volver a pedir. Una foto con esquema local (file://, content://)
-- todavía no se subió y no cuenta: espejo de ESQUEMAS_FOTO_LOCAL de la web.
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
      coalesce(t.foto_url, '') <> ''
        AND t.foto_url NOT LIKE 'file://%'
        AND t.foto_url NOT LIKE 'content://%' AS con_foto,
      count(*) AS cantidad
    FROM trees t
    JOIN groups g ON g.id = t.group_id
    WHERE g.plantation_id = p_plantation_id
    GROUP BY 1, 2, 3, 4, 5
  ) conteos;
$$;

ALTER FUNCTION "public"."dashboard_arboles"("uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."dashboard_arboles"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."dashboard_arboles"("uuid") TO "authenticated", "service_role";

-- ── Explorador de datos ──────────────────────────────────────────────────────

-- Cada grupo de la plantación con su parcela y su cantidad de árboles, incluidos
-- los grupos vacíos. Alcanza para los conteos por parcela y por grupo.
CREATE OR REPLACE FUNCTION "public"."arboles_por_grupo"("p_plantation_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY INVOKER
    SET "search_path" TO 'public'
    AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'group_id', id,
    'parcela_id', parcela_id,
    'arboles', arboles
  )), '[]'::jsonb)
  FROM (
    SELECT g.id, g.parcela_id, count(t.id) AS arboles
    FROM groups g
    LEFT JOIN trees t ON t.group_id = g.id
    WHERE g.plantation_id = p_plantation_id
    GROUP BY g.id, g.parcela_id
  ) conteos;
$$;

ALTER FUNCTION "public"."arboles_por_grupo"("uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."arboles_por_grupo"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."arboles_por_grupo"("uuid") TO "authenticated", "service_role";
