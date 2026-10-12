-- Se dropean los IDs numéricos de los árboles y los RPC que los generaban (#859).
--
-- Desde #822 (080) ningún cliente los escribe, muestra ni llama. El APK de prod
-- 1.3.0 los lee del pull con `select('*')` y `?? null`: sin las columnas sigue
-- andando, pero no ofrece CSV/Excel en una plantación bajada desde cero.
--
-- En prod va después del deploy de la web del pase: la anterior exporta con
-- `global_id` y llama a los RPC.
--
-- Sin CASCADE: nada depende de las columnas, y si una base tuviera algo, la
-- migración falla en vez de llevárselo.
--
-- Rollback: ALTER TABLE trees ADD COLUMN plantacion_id integer, ADD COLUMN
-- global_id integer; recrear plantation_ids_status y next_global_id_seed como
-- en 032 y generate_tree_ids como en 051, con sus grants. Los IDs que tenían los
-- árboles no vuelven.

DROP FUNCTION IF EXISTS "public"."generate_tree_ids"("uuid", integer);
DROP FUNCTION IF EXISTS "public"."next_global_id_seed"();
DROP FUNCTION IF EXISTS "public"."plantation_ids_status"("uuid");

ALTER TABLE "public"."trees"
  DROP COLUMN IF EXISTS "global_id",
  DROP COLUMN IF EXISTS "plantacion_id";
