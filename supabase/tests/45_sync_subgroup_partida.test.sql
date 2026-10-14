-- sync_subgroup partida (064, #734; 065 suma dos partes, #679; 075 nueve, #802): las partes no se
-- ejecutan desde el cliente y la orquestadora sigue siendo el único RPC, corto y
-- con los mismos grants.
begin;
select plan(8);

create temp view partes_45 as
  select p.oid, p.proname::text as nombre, p.prosecdef, p.proconfig
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname like 'sync\_subgroup\_%';

select is(
  (select array_agg(nombre order by nombre) from partes_45),
  array['sync_subgroup_anotar_fotos_descartadas', 'sync_subgroup_campos_grupo', 'sync_subgroup_codigo_parcela',
        'sync_subgroup_conservadas', 'sync_subgroup_conservado_arbol', 'sync_subgroup_conservados',
        'sync_subgroup_conservar_especies', 'sync_subgroup_conservar_fotos_y_gps', 'sync_subgroup_conservar_grupo',
        'sync_subgroup_foto_difiere', 'sync_subgroup_gps_difiere', 'sync_subgroup_habilitar_especies',
        'sync_subgroup_punto_distinto', 'sync_subgroup_rechazo', 'sync_subgroup_upsert_arboles',
        'sync_subgroup_upsert_grupo'],
  'las dieciséis partes existen');

select is(
  (select count(*)::int from partes_45
    where has_function_privilege('authenticated', oid, 'execute')
       or has_function_privilege('anon', oid, 'execute')),
  0, 'ni authenticated ni anon ejecutan una parte');

select is(
  (select count(*)::int from partes_45 where has_function_privilege('service_role', oid, 'execute')),
  16, 'service_role ejecuta las partes');

select is(
  (select count(*)::int from partes_45 where prosecdef or not coalesce('search_path=public' = any(proconfig), false)),
  0, 'las partes son SECURITY INVOKER con search_path=public fijo');

select ok(
  (select prosecdef from pg_proc where oid = 'public.sync_subgroup(jsonb, jsonb)'::regprocedure),
  'sync_subgroup sigue siendo SECURITY DEFINER');

select ok(
  has_function_privilege('authenticated', 'public.sync_subgroup(jsonb, jsonb)', 'execute'),
  'authenticated ejecuta sync_subgroup');

select ok(
  has_function_privilege('service_role', 'public.sync_subgroup(jsonb, jsonb)', 'execute'),
  'service_role ejecuta sync_subgroup');

select cmp_ok(
  array_length(string_to_array(pg_get_functiondef('public.sync_subgroup(jsonb, jsonb)'::regprocedure), E'\n'), 1),
  '<', 40, 'la orquestadora tiene menos de 40 líneas');

select * from finish();
rollback;
