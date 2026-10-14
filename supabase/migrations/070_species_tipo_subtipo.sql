-- Tipo y subtipo de cada especie (#752). Por ahora el único tipo es «flora», con
-- subtipo «arbol» o «arbusto». Espejo de contracts/tipos-especie.json: el CHECK
-- y los DEFAULT cambian junto con el contrato.
--
-- Los DEFAULT dejan las especies existentes como flora / arbol y cubren a quien
-- inserta sin nombrar las columnas: el seed, los tests y cualquier cliente
-- anterior a este cambio. Las APKs no insertan especies en el server.
--
-- Un solo CHECK sobre el par valida a la vez los valores y que el subtipo sea de
-- ese tipo.
--
-- Rollback: ALTER TABLE species DROP CONSTRAINT species_tipo_subtipo_valido,
-- DROP COLUMN subtipo, DROP COLUMN tipo. La web de este cambio deja de cargar
-- el catálogo; mobile ignora las columnas que no llegan.

ALTER TABLE "public"."species"
  ADD COLUMN IF NOT EXISTS "tipo" "text" DEFAULT 'flora' NOT NULL,
  ADD COLUMN IF NOT EXISTS "subtipo" "text" DEFAULT 'arbol' NOT NULL;

ALTER TABLE "public"."species" DROP CONSTRAINT IF EXISTS "species_tipo_subtipo_valido";
ALTER TABLE "public"."species"
  ADD CONSTRAINT "species_tipo_subtipo_valido"
  CHECK (("tipo", "subtipo") IN (('flora', 'arbol'), ('flora', 'arbusto')));
