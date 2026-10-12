-- Se dropean los IDs numéricos de los árboles y los RPC que los generaban (#859).
--
-- Desde #822 (080) ningún cliente escribe ni muestra `trees.global_id` ni
-- `trees.plantacion_id`, y la web ya no llama a `generate_tree_ids`,
-- `next_global_id_seed` ni `plantation_ids_status`. El APK de prod 1.3.0 baja
-- los árboles con `select('*')` y lee las dos columnas con `?? null`: sin ellas,
-- el pull sigue andando. Un celular con ese APK que baje una plantación desde
-- cero ya no recibe los IDs viejos y no ofrece CSV/Excel; la web exporta.
--
-- Las columnas no tienen índices, constraints, vistas, policies ni triggers, y
-- ninguna otra función las nombra. Sin CASCADE: si una base tuviera algo que
-- dependa de ellas, la migración falla en vez de llevárselo.
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
