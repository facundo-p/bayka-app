-- IDs numéricos de los árboles dados de baja (#822, #859): no quedan las
-- columnas ni los RPC que las escribían, y un APK que todavía mande
-- `plantacion_id` y `global_id` en el payload de sync_subgroup sincroniza igual.
begin;
select plan(10);

select hasnt_column('public', 'trees', 'global_id', 'trees.global_id no existe');
select hasnt_column('public', 'trees', 'plantacion_id', 'trees.plantacion_id no existe');
select hasnt_function('public', 'generate_tree_ids', 'generate_tree_ids no existe');
select hasnt_function('public', 'next_global_id_seed', 'next_global_id_seed no existe');
select hasnt_function('public', 'plantation_ids_status', 'plantation_ids_status no existe');
select hasnt_function('public', 'update_tree_ids', 'update_tree_ids no existe');

insert into organizations (id, nombre) values
  ('b6300000-0000-0000-0000-000000000001', 'Org Test 63');

insert into auth.users (id, email) values
  ('b6300000-0000-0000-0000-0000000000a1', 'tecnico-63@test.local');

update profiles set organizacion_id = 'b6300000-0000-0000-0000-000000000001'
  where id = 'b6300000-0000-0000-0000-0000000000a1';

insert into species (id, codigo, nombre) values
  ('b6300000-0000-0000-0000-0000000000e1', 'T63A', 'Acacia 63');

select tests.crear_plantacion('b6300000-0000-0000-0000-000000000002', 'b6300000-0000-0000-0000-000000000001',
  'b6300000-0000-0000-0000-0000000000a1', 'Activa 63');

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b6300000-0000-0000-0000-000000000002', 'b6300000-0000-0000-0000-0000000000a1', 'tecnico');

insert into plantation_species (plantation_id, species_id, orden_visual) values
  ('b6300000-0000-0000-0000-000000000002', 'b6300000-0000-0000-0000-0000000000e1', 0);

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b6300000-0000-0000-0000-0000000000b1', 'b6300000-0000-0000-0000-000000000002', 'Norte', 'P1');

create temp table grupo_63 as select jsonb_build_object(
  'id', 'b6300000-0000-0000-0000-0000000000c1',
  'plantation_id', 'b6300000-0000-0000-0000-000000000002',
  'parcela_id', 'b6300000-0000-0000-0000-0000000000b1',
  'parcela_codigo', 'P1',
  'nombre', 'Uno', 'codigo', 'L1', 'tipo', 'linea', 'estado', 'activa',
  'usuario_creador', 'b6300000-0000-0000-0000-0000000000a1',
  'created_at', now()
) as g;
grant select on grupo_63 to authenticated;

-- Árbol como lo arma un APK viejo: con los dos IDs numéricos.
create temp table arbol_63 as select jsonb_build_object(
  'id', 'b6300000-0000-0000-0000-0000000000d1',
  'group_id', 'b6300000-0000-0000-0000-0000000000c1', 'posicion', 1,
  'species_id', 'b6300000-0000-0000-0000-0000000000e1', 'sub_id', 'P1L1T63A1',
  'plantacion_id', 6301, 'global_id', 6302,
  'usuario_registro', 'b6300000-0000-0000-0000-0000000000a1', 'created_at', now()
) as t;
grant select on arbol_63 to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b6300000-0000-0000-0000-0000000000a1', true);

select is(
  ( select sync_subgroup((select g from grupo_63), jsonb_build_array((select t from arbol_63))) ->> 'success' ),
  'true',
  'un payload con plantacion_id y global_id sincroniza');

select is(
  ( select sync_subgroup((select g from grupo_63), jsonb_build_array((select t from arbol_63))) ->> 'success' ),
  'true',
  'y su re-sync también');

reset role;

select is((select sub_id from trees where id = 'b6300000-0000-0000-0000-0000000000d1'),
  'P1L1T63A1', 'el árbol queda con el resto de lo que mandó');
select is((select count(*)::int from trees where group_id = 'b6300000-0000-0000-0000-0000000000c1'),
  1, 'sin árboles de más');

select * from finish();
rollback;
