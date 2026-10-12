-- Se dropean los IDs numéricos de los árboles y los RPC que los generaban (#859).
--
-- Desde #822 (080) ningún cliente los escribe, muestra ni llama. El APK de prod
-- 1.3.0 los lee del pull con `select('*')` y `?? null`: sin las columnas sigue
-- andando, pero no ofrece CSV/Excel en una plantación bajada desde cero.
--
-- En prod va apenas termina el deploy de la web del pase (check Cloudflare
-- Pages del merge en main en verde), ni antes ni mucho después: la web anterior
-- exporta con `global_id` y llama a los RPC, y la nueva necesita la 079, que va
-- en el mismo push.
--
-- Antes del push a prod, esta consulta de solo lectura tiene que devolver solo
-- los tres RPC: el dry-run no ve funciones creadas a mano.
--   select p.oid::regprocedure from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname not in ('pg_catalog', 'information_schema')
--      and p.prosrc ~* '(global_id|plantacion_id|generate_tree_ids|next_global_id_seed|plantation_ids_status)';
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
