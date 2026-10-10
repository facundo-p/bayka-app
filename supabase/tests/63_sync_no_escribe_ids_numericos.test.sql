-- sync_subgroup ignora `plantacion_id` y `global_id` del payload (#822): un APK
-- que todavía los mande sincroniza igual, un árbol nuevo queda sin IDs
-- numéricos y uno que ya los tenía los conserva.
begin;
select plan(7);

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

reset role;

select is((select (plantacion_id, global_id)::text from trees where id = 'b6300000-0000-0000-0000-0000000000d1'),
  '(,)', 'el árbol nuevo queda sin IDs numéricos');
select is((select sub_id from trees where id = 'b6300000-0000-0000-0000-0000000000d1'),
  'P1L1T63A1', 'y con el resto de lo que mandó');

-- Un árbol numerado antes de #822.
update trees set plantacion_id = 1, global_id = 1001
  where id = 'b6300000-0000-0000-0000-0000000000d1';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b6300000-0000-0000-0000-0000000000a1', true);

select is(
  ( select sync_subgroup((select g from grupo_63), jsonb_build_array((select t from arbol_63))) ->> 'success' ),
  'true',
  'el re-sync de un árbol numerado con otros IDs en el payload sincroniza');

select is(
  ( select sync_subgroup((select g from grupo_63),
      jsonb_build_array((select t from arbol_63) - 'plantacion_id' - 'global_id')) ->> 'success' ),
  'true',
  'y el re-sync sin los IDs, como el APK nuevo, también');

reset role;

select is((select (plantacion_id, global_id)::text from trees where id = 'b6300000-0000-0000-0000-0000000000d1'),
  '(1,1001)', 'el árbol numerado conserva sus IDs');
select is((select count(*)::int from trees where group_id = 'b6300000-0000-0000-0000-0000000000c1'),
  1, 'sin árboles de más');

select * from finish();
rollback;
