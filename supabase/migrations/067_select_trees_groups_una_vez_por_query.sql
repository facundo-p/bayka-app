-- La policy SELECT de `trees` y `groups` se evalúa una vez por query (#682).
--
-- Antes: `is_plantation_member()` por fila. Es SECURITY DEFINER, no se inlinea,
-- y en `trees` además corría dentro de un EXISTS sobre `groups`, que volvía a
-- aplicar la policy de `groups`. Contar los árboles de una plantación costaba
-- dos llamadas por árbol.
--
-- Ahora: `mis_plantaciones()` devuelve las plantaciones del usuario en un array,
-- con la misma regla que `is_plantation_member()` (membresía y perfil activo).
-- Envuelto en `(select …)`, Postgres lo calcula una vez (InitPlan) y compara por
-- fila contra el array.
--
-- Suma índices para la temporada activa de la web (orden por `created_at`) y
-- la FK `species_id`, y el RPC `catalogo_conteos` para que el catálogo mobile
-- deje de bajar todos los árboles solo para contarlos.
--
-- Rollback: recrear de 033 las policies "Members can read subgroups" y "Members
-- can read trees"; DROP FUNCTION catalogo_conteos(uuid[]) y mis_plantaciones();
-- DROP INDEX trees_created_at_idx y trees_species_id_idx. Un APK que ya use el
-- RPC deja de cargar el catálogo. En el repo, el rollback borra también el
-- test 49.

-- ── Helper ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION "public"."mis_plantaciones"() RETURNS "uuid"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT coalesce(array_agg(pu.plantation_id), '{}')
  FROM plantation_users pu
  JOIN profiles pr ON pr.id = pu.user_id
  WHERE pu.user_id = auth.uid()
    AND pr.activo;
$$;

ALTER FUNCTION "public"."mis_plantaciones"() OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."mis_plantaciones"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."mis_plantaciones"() TO "authenticated", "service_role";

-- ── Policies ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Members can read subgroups" ON "public"."groups";
CREATE POLICY "Members can read subgroups" ON "public"."groups" FOR SELECT TO "authenticated"
  USING ("plantation_id" = ANY ((SELECT "public"."mis_plantaciones"())::"uuid"[]));

DROP POLICY IF EXISTS "Members can read trees" ON "public"."trees";
CREATE POLICY "Members can read trees" ON "public"."trees" FOR SELECT TO "authenticated"
  USING ("group_id" IN (
    SELECT g.id FROM "public"."groups" g
    WHERE g.plantation_id = ANY ((SELECT "public"."mis_plantaciones"())::"uuid"[])
  ));

-- ── Índices ──────────────────────────────────────────────────────────────────

-- Sin CONCURRENTLY porque la migración corre en una transacción: bloquean
-- escrituras en trees mientras se arman. Con decenas de miles de filas son
-- segundos; aplicar fuera del horario de sync.
CREATE INDEX IF NOT EXISTS "trees_created_at_idx" ON "public"."trees" USING "btree" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "trees_species_id_idx" ON "public"."trees" USING "btree" ("species_id");

-- ── Conteos del catálogo mobile ──────────────────────────────────────────────

-- SECURITY INVOKER: cuenta solo lo que el usuario puede leer, igual que las
-- queries que reemplaza. Una plantación sin grupos no aparece; el cliente la
-- cuenta en cero.
CREATE OR REPLACE FUNCTION "public"."catalogo_conteos"("p_ids" "uuid"[])
    RETURNS TABLE("plantation_id" "uuid", "grupos" bigint, "arboles" bigint)
    LANGUAGE "sql" STABLE SECURITY INVOKER
    SET "search_path" TO 'public'
    AS $$
  SELECT g.plantation_id, count(DISTINCT g.id), count(t.id)
  FROM groups g
  LEFT JOIN trees t ON t.group_id = g.id
  WHERE g.plantation_id = ANY (p_ids)
  GROUP BY g.plantation_id;
$$;

ALTER FUNCTION "public"."catalogo_conteos"("uuid"[]) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."catalogo_conteos"("uuid"[]) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."catalogo_conteos"("uuid"[]) TO "authenticated", "service_role";
