-- Especie científica como entidad (#753): agrupa las especies que son la misma
-- planta con distinto nombre común según la región. Vincularla desde la
-- especie es opcional.
--
-- species.nombre_cientifico queda como copia del nombre de la entidad, que
-- mantienen dos triggers. Mobile la baja con select('*') y la muestra: sigue
-- igual, sin migración local ni APK nuevo. Escribir esa columna directo no
-- sirve: el trigger la vuelve a copiar de la entidad, o la deja en null.
--
-- El nombre se guarda sin espacios de más, y dos nombres que solo difieren en
-- mayúsculas o espacios son el mismo (índice único sobre lower(nombre)).
--
-- Datos: cada nombre_cientifico distinto pasa a ser una entidad, y la especie
-- queda vinculada. Entre variantes que solo cambian en mayúsculas gana la más
-- usada.
--
-- Rollback: DROP TRIGGER trg_species_copia_nombre_cientifico ON species,
-- trg_especies_cientificas_normaliza_nombre y
-- trg_especies_cientificas_propaga_nombre ON especies_cientificas; ALTER TABLE
-- species DROP COLUMN especie_cientifica_id; DROP TABLE especies_cientificas;
-- DROP FUNCTION de los tres triggers, vincular_nombres_cientificos() y
-- nombre_cientifico_normalizado(text). La copia en species.nombre_cientifico
-- queda con el último nombre de la entidad.

CREATE OR REPLACE FUNCTION "public"."nombre_cientifico_normalizado"("p_nombre" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT btrim(regexp_replace(p_nombre, '\s+', ' ', 'g'));
$$;

ALTER FUNCTION "public"."nombre_cientifico_normalizado"("text") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."especies_cientificas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "nombre" "text" NOT NULL CONSTRAINT "especies_cientificas_nombre_no_vacio" CHECK ("nombre" <> ''),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."especies_cientificas" OWNER TO "postgres";

CREATE UNIQUE INDEX IF NOT EXISTS "especies_cientificas_nombre_unico"
  ON "public"."especies_cientificas" (lower("nombre"));

CREATE OR REPLACE FUNCTION "public"."normalizar_nombre_de_especie_cientifica"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.nombre := nombre_cientifico_normalizado(NEW.nombre);
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."normalizar_nombre_de_especie_cientifica"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "trg_especies_cientificas_normaliza_nombre" ON "public"."especies_cientificas";
CREATE TRIGGER "trg_especies_cientificas_normaliza_nombre"
  BEFORE INSERT OR UPDATE OF "nombre" ON "public"."especies_cientificas"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."normalizar_nombre_de_especie_cientifica"();

-- Como species: la lee cualquier autenticado y la escribe un admin activo.
ALTER TABLE "public"."especies_cientificas" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."especies_cientificas" FROM PUBLIC, "anon";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."especies_cientificas" TO "authenticated";
GRANT ALL ON TABLE "public"."especies_cientificas" TO "service_role";

DROP POLICY IF EXISTS "Authenticated users can read especies_cientificas" ON "public"."especies_cientificas";
CREATE POLICY "Authenticated users can read especies_cientificas" ON "public"."especies_cientificas"
  FOR SELECT TO "authenticated"
  USING (true);

DROP POLICY IF EXISTS "Admin can insert especies_cientificas" ON "public"."especies_cientificas";
CREATE POLICY "Admin can insert especies_cientificas" ON "public"."especies_cientificas"
  FOR INSERT TO "authenticated"
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin can update especies_cientificas" ON "public"."especies_cientificas";
CREATE POLICY "Admin can update especies_cientificas" ON "public"."especies_cientificas"
  FOR UPDATE TO "authenticated"
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin can delete especies_cientificas" ON "public"."especies_cientificas";
CREATE POLICY "Admin can delete especies_cientificas" ON "public"."especies_cientificas"
  FOR DELETE TO "authenticated"
  USING (is_admin());

-- RESTRICT: una especie científica que agrupa especies no se borra.
ALTER TABLE "public"."species"
  ADD COLUMN IF NOT EXISTS "especie_cientifica_id" "uuid"
  REFERENCES "public"."especies_cientificas"("id") ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS "species_especie_cientifica_id_idx"
  ON "public"."species" ("especie_cientifica_id");

-- En cada escritura de species, sin lista de columnas: así ningún camino deja
-- la copia distinta de la entidad.
CREATE OR REPLACE FUNCTION "public"."copiar_nombre_cientifico"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.nombre_cientifico := (
    SELECT nombre FROM especies_cientificas WHERE id = NEW.especie_cientifica_id
  );
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."copiar_nombre_cientifico"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "trg_species_copia_nombre_cientifico" ON "public"."species";
CREATE TRIGGER "trg_species_copia_nombre_cientifico"
  BEFORE INSERT OR UPDATE ON "public"."species"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."copiar_nombre_cientifico"();

-- SECURITY DEFINER: renombrar la entidad actualiza todas sus especies aunque
-- quien renombra no pudiera escribir alguna.
CREATE OR REPLACE FUNCTION "public"."propagar_nombre_cientifico"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE species SET nombre_cientifico = NEW.nombre WHERE especie_cientifica_id = NEW.id;
  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."propagar_nombre_cientifico"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "trg_especies_cientificas_propaga_nombre" ON "public"."especies_cientificas";
CREATE TRIGGER "trg_especies_cientificas_propaga_nombre"
  AFTER UPDATE OF "nombre" ON "public"."especies_cientificas"
  FOR EACH ROW
  WHEN (OLD."nombre" IS DISTINCT FROM NEW."nombre")
  EXECUTE FUNCTION "public"."propagar_nombre_cientifico"();

-- Datos. Corre después de los triggers: al vincular, la copia toma el nombre
-- de la entidad, y las especies sin vínculo quedan en null. Es una función
-- para poder testearla sobre filas cargadas.
CREATE OR REPLACE FUNCTION "public"."vincular_nombres_cientificos"() RETURNS void
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO especies_cientificas (nombre)
  SELECT mode() WITHIN GROUP (ORDER BY normalizado)
    FROM (SELECT nombre_cientifico_normalizado(nombre_cientifico) AS normalizado
            FROM species
           WHERE nombre_cientifico IS NOT NULL) AS nombres
   WHERE normalizado <> ''
   GROUP BY lower(normalizado)
  ON CONFLICT DO NOTHING;

  UPDATE species AS s
     SET especie_cientifica_id = e.id
    FROM especies_cientificas AS e
   WHERE s.especie_cientifica_id IS NULL
     AND lower(nombre_cientifico_normalizado(s.nombre_cientifico)) = lower(e.nombre);

  UPDATE species
     SET nombre_cientifico = NULL
   WHERE especie_cientifica_id IS NULL
     AND nombre_cientifico IS NOT NULL;
END;
$$;

ALTER FUNCTION "public"."vincular_nombres_cientificos"() OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."vincular_nombres_cientificos"() FROM PUBLIC, "anon", "authenticated";

SELECT "public"."vincular_nombres_cientificos"();
