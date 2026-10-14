-- sync_subgroup no escribe fuera del grupo que sube (#732): un árbol de otro
-- grupo o plantación, un grupo de otra plantación o parcela, o una parcela de
-- otra plantación rechazan todo el sync sin escribir nada. El re-sync de un
-- árbol propio y el alta de un grupo con sus árboles siguen andando.
begin;
select plan(30);

insert into organizations (id, nombre) values
  ('b4600000-0000-0000-0000-000000000001', 'Org Test 46');

insert into auth.users (id, email) values
  ('b4600000-0000-0000-0000-0000000000a1', 'tecnico-46@test.local');

update profiles set organizacion_id = 'b4600000-0000-0000-0000-000000000001'
  where id = 'b4600000-0000-0000-0000-0000000000a1';

insert into species (id, codigo, nombre) values
  ('b4600000-0000-0000-0000-0000000000e1', 'T46A', 'Acacia 46'),
  ('b4600000-0000-0000-0000-0000000000e2', 'T46B', 'Barba 46');

-- A: la del técnico. B: una a la que no pertenece.
select tests.crear_plantacion('b4600000-0000-0000-0000-00000000000a', 'b4600000-0000-0000-0000-000000000001',
  'b4600000-0000-0000-0000-0000000000a1', 'Propia 46');
select tests.crear_plantacion('b4600000-0000-0000-0000-00000000000b', 'b4600000-0000-0000-0000-000000000001',
  'b4600000-0000-0000-0000-0000000000a1', 'Ajena 46');

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b4600000-0000-0000-0000-00000000000a', 'b4600000-0000-0000-0000-0000000000a1', 'tecnico');

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b4600000-0000-0000-0000-0000000000ba', 'b4600000-0000-0000-0000-00000000000a', 'Norte', 'P1'),
  ('b4600000-0000-0000-0000-0000000000bc', 'b4600000-0000-0000-0000-00000000000a', 'Este', 'P2'),
  ('b4600000-0000-0000-0000-0000000000bb', 'b4600000-0000-0000-0000-00000000000b', 'Sur', 'P9');

-- c1 es el grupo que sube; c2 otro grupo de A; cb el de B.
insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, estado, usuario_creador) values
  ('b4600000-0000-0000-0000-0000000000c1', 'b4600000-0000-0000-0000-00000000000a',
   'b4600000-0000-0000-0000-0000000000ba', 'Uno', 'L1', 'linea', 'activa', 'b4600000-0000-0000-0000-0000000000a1'),
  ('b4600000-0000-0000-0000-0000000000c2', 'b4600000-0000-0000-0000-00000000000a',
   'b4600000-0000-0000-0000-0000000000ba', 'Dos', 'L2', 'linea', 'activa', 'b4600000-0000-0000-0000-0000000000a1'),
  ('b4600000-0000-0000-0000-0000000000cb', 'b4600000-0000-0000-0000-00000000000b',
   'b4600000-0000-0000-0000-0000000000bb', 'Ajeno', 'L9', 'linea', 'activa', 'b4600000-0000-0000-0000-0000000000a1');

insert into trees (id, group_id, species_id, posicion, sub_id, foto_url, usuario_registro) values
  ('b4600000-0000-0000-0000-0000000000d1', 'b4600000-0000-0000-0000-0000000000c1',
   'b4600000-0000-0000-0000-0000000000e1', 1, 'P1L1T46A1', 'fotos/d1.jpg', 'b4600000-0000-0000-0000-0000000000a1'),
  ('b4600000-0000-0000-0000-0000000000d3', 'b4600000-0000-0000-0000-0000000000c1',
   'b4600000-0000-0000-0000-0000000000e1', 3, 'P1L1T46A3', 'fotos/d3.jpg', 'b4600000-0000-0000-0000-0000000000a1'),
  ('b4600000-0000-0000-0000-0000000000d2', 'b4600000-0000-0000-0000-0000000000c2',
   'b4600000-0000-0000-0000-0000000000e1', 1, 'P1L2T46A1', 'fotos/d2.jpg', 'b4600000-0000-0000-0000-0000000000a1'),
  ('b4600000-0000-0000-0000-0000000000db', 'b4600000-0000-0000-0000-0000000000cb',
   'b4600000-0000-0000-0000-0000000000e1', 1, 'P9L9T46A1', 'fotos/db.jpg', 'b4600000-0000-0000-0000-0000000000a1');

create temp table grupo_46 as select jsonb_build_object(
  'id', 'b4600000-0000-0000-0000-0000000000c1',
  'plantation_id', 'b4600000-0000-0000-0000-00000000000a',
  'parcela_id', 'b4600000-0000-0000-0000-0000000000ba',
  'parcela_codigo', 'P1',
  'nombre', 'Uno', 'codigo', 'L1', 'tipo', 'linea', 'estado', 'activa',
  'usuario_creador', 'b4600000-0000-0000-0000-0000000000a1',
  'created_at', now()
) as g;
grant select on grupo_46 to authenticated;

-- Un árbol del payload: id y grupo a elección, el resto con valores que se notan si se escriben.
create function pg_temp.arbol_46(p_id text, p_grupo text) returns jsonb language sql as $$
  select jsonb_build_object('id', p_id, 'subgroup_id', p_grupo, 'posicion', 7,
    'species_id', 'b4600000-0000-0000-0000-0000000000e2', 'sub_id', 'PISADO',
    'foto_url', 'fotos/pisada.jpg',
    'usuario_registro', 'b4600000-0000-0000-0000-0000000000a1', 'created_at', now());
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b4600000-0000-0000-0000-0000000000a1', true);

select is(
  (select sync_subgroup((select g from grupo_46),
     jsonb_build_array(pg_temp.arbol_46('b4600000-0000-0000-0000-0000000000db', 'b4600000-0000-0000-0000-0000000000c1')))
   ->> 'error'),
  'UNKNOWN', 'un árbol de otra plantación con el grupo propio se rechaza');

select is(
  (select sync_subgroup((select g from grupo_46),
     jsonb_build_array(pg_temp.arbol_46('b4600000-0000-0000-0000-0000000000db', 'b4600000-0000-0000-0000-0000000000cb')))
   ->> 'error'),
  'UNKNOWN', 'y con el grupo ajeno también');

select is(
  (select sync_subgroup((select g from grupo_46),
     jsonb_build_array(pg_temp.arbol_46('b4600000-0000-0000-0000-0000000000d2', 'b4600000-0000-0000-0000-0000000000c1')))
   ->> 'error'),
  'UNKNOWN', 'un árbol de otro grupo de la misma plantación se rechaza');

select is(
  (select sync_subgroup((select g from grupo_46),
     jsonb_build_array(
       pg_temp.arbol_46('b4600000-0000-0000-0000-0000000000d1', 'b4600000-0000-0000-0000-0000000000c1'),
       pg_temp.arbol_46('b4600000-0000-0000-0000-0000000000d9', 'b4600000-0000-0000-0000-0000000000cb')))
   ->> 'error'),
  'UNKNOWN', 'un árbol nuevo con el grupo de otra plantación se rechaza, junto con el resto');

select is(
  (select sync_subgroup((select g from grupo_46) || jsonb_build_object(
     'id', 'b4600000-0000-0000-0000-0000000000cb', 'nombre', 'Pisado', 'codigo', 'LX', 'estado', 'finalizada'),
     '[]'::jsonb) ->> 'error'),
  'REFERENCIA_AJENA', 'el id de un grupo de otra plantación responde REFERENCIA_AJENA');

select is(
  (select sync_subgroup((select g from grupo_46) || jsonb_build_object(
     'id', 'b4600000-0000-0000-0000-0000000000c3', 'nombre', 'Tres', 'codigo', 'L3',
     'parcela_id', 'b4600000-0000-0000-0000-0000000000bb'),
     '[]'::jsonb) ->> 'error'),
  'REFERENCIA_AJENA', 'una parcela de otra plantación también');

select is(
  (select sync_subgroup((select g from grupo_46) || jsonb_build_object(
     'id', 'b4600000-0000-0000-0000-0000000000c4', 'nombre', 'Ajeno', 'codigo', 'L9',
     'parcela_id', 'b4600000-0000-0000-0000-0000000000bb'),
     '[]'::jsonb) ->> 'error'),
  'REFERENCIA_AJENA', 'antes que DUPLICATE_CODE: no revela códigos de una parcela ajena');

select is(
  (select sync_subgroup((select g from grupo_46) || jsonb_build_object(
     'parcela_id', 'b4600000-0000-0000-0000-0000000000bc', 'parcela_codigo', 'P2'),
     '[]'::jsonb) ->> 'error'),
  'REFERENCIA_AJENA', 'el grupo propio con otra parcela de la misma plantación también');

-- Pasa el chequeo del group_id y lo frena el conteo: el árbol propio del lote no se toca.
select is(
  (select sync_subgroup((select g from grupo_46),
     jsonb_build_array(
       pg_temp.arbol_46('b4600000-0000-0000-0000-0000000000d3', 'b4600000-0000-0000-0000-0000000000c1'),
       pg_temp.arbol_46('b4600000-0000-0000-0000-0000000000db', 'b4600000-0000-0000-0000-0000000000c1')))
   ->> 'error'),
  'UNKNOWN', 'un árbol ajeno en un lote con uno propio rechaza el lote');

select is(
  (select sync_subgroup((select g from grupo_46),
     jsonb_build_array(pg_temp.arbol_46('b4600000-0000-0000-0000-0000000000d3', 'b4600000-0000-0000-0000-0000000000c1')
       || jsonb_build_object('group_id', 'b4600000-0000-0000-0000-0000000000c2')))
   ->> 'error'),
  'UNKNOWN', 'group_id manda sobre subgroup_id');

-- Lo legítimo: re-sync del árbol propio (group_id null cae en subgroup_id) y alta de grupo con árbol.
select is(
  (select sync_subgroup((select g from grupo_46),
     jsonb_build_array(pg_temp.arbol_46('b4600000-0000-0000-0000-0000000000d1', 'b4600000-0000-0000-0000-0000000000c1')
       || jsonb_build_object('group_id', null)))
   ->> 'success'),
  'true', 'el re-sync de un árbol propio sigue andando');

select is(
  (select sync_subgroup((select g from grupo_46) || jsonb_build_object(
     'id', 'b4600000-0000-0000-0000-0000000000c5', 'nombre', 'Cinco', 'codigo', 'L5'),
     jsonb_build_array(pg_temp.arbol_46('b4600000-0000-0000-0000-0000000000d5', 'b4600000-0000-0000-0000-0000000000c5')))
   ->> 'success'),
  'true', 'el alta de un grupo con un árbol nuevo sigue andando');

reset role;

select is(
  (select (species_id, sub_id, foto_url, group_id)::text from trees where id = 'b4600000-0000-0000-0000-0000000000db'),
  '(b4600000-0000-0000-0000-0000000000e1,P9L9T46A1,fotos/db.jpg,b4600000-0000-0000-0000-0000000000cb)',
  'el árbol de la otra plantación quedó intacto');
select is(
  (select (species_id, sub_id, foto_url, group_id)::text from trees where id = 'b4600000-0000-0000-0000-0000000000d2'),
  '(b4600000-0000-0000-0000-0000000000e1,P1L2T46A1,fotos/d2.jpg,b4600000-0000-0000-0000-0000000000c2)',
  'el del otro grupo también');
select is(
  (select (species_id, sub_id, foto_url)::text from trees where id = 'b4600000-0000-0000-0000-0000000000d3'),
  '(b4600000-0000-0000-0000-0000000000e1,P1L1T46A3,fotos/d3.jpg)',
  'el árbol propio de los lotes rechazados quedó intacto');
select is((select group_id from trees where id = 'b4600000-0000-0000-0000-0000000000d5'),
  'b4600000-0000-0000-0000-0000000000c5'::uuid, 'el árbol nuevo quedó en su grupo nuevo');
select is((select count(*)::int from trees where id = 'b4600000-0000-0000-0000-0000000000d9'),
  0, 'el árbol nuevo en el grupo ajeno no se creó');
select is((select count(*)::int from trees where group_id = 'b4600000-0000-0000-0000-0000000000cb'),
  1, 'el grupo ajeno sigue con su único árbol');
select is(
  (select (nombre, codigo, estado)::text from groups where id = 'b4600000-0000-0000-0000-0000000000cb'),
  '(Ajeno,L9,activa)', 'el grupo de la otra plantación quedó intacto');
select is((select count(*)::int from groups where id = 'b4600000-0000-0000-0000-0000000000c3'),
  0, 'el grupo con parcela ajena no se creó');
select is(
  (select array_agg(species_id) from plantation_species where plantation_id = 'b4600000-0000-0000-0000-00000000000a'),
  array['b4600000-0000-0000-0000-0000000000e2']::uuid[],
  'solo el sync legítimo habilitó su especie');

select is((select species_id from trees where id = 'b4600000-0000-0000-0000-0000000000d1'),
  'b4600000-0000-0000-0000-0000000000e2'::uuid, 'el re-sync propio pisa la especie');
select is((select sub_id from trees where id = 'b4600000-0000-0000-0000-0000000000d1'),
  'PISADO', 'y el SubID');
select is((select foto_url from trees where id = 'b4600000-0000-0000-0000-0000000000d1'),
  'fotos/pisada.jpg', 'y la foto');
select is((select posicion from trees where id = 'b4600000-0000-0000-0000-0000000000d1'),
  1, 'pero no la posición');

-- Las partes rechazan aunque las llamen solas.
select throws_ok(
  $$ select sync_subgroup_upsert_grupo((select g from grupo_46) || jsonb_build_object(
       'id', 'b4600000-0000-0000-0000-0000000000cb', 'nombre', 'Pisado', 'codigo', 'LX')) $$,
  '42501', null, 'upsert_grupo: grupo de otra plantación');
select throws_ok(
  $$ select sync_subgroup_upsert_arboles((select g from grupo_46),
       jsonb_build_array(pg_temp.arbol_46('b4600000-0000-0000-0000-0000000000db', 'b4600000-0000-0000-0000-0000000000c1')), 'P1') $$,
  '42501', null, 'upsert_arboles: árbol existente de otro grupo');
select throws_ok(
  $$ select sync_subgroup_upsert_arboles((select g from grupo_46),
       jsonb_build_array(pg_temp.arbol_46('b4600000-0000-0000-0000-0000000000d8', 'b4600000-0000-0000-0000-0000000000c2')), 'P1') $$,
  '42501', null, 'upsert_arboles: árbol nuevo con otro grupo');
select throws_ok(
  $$ select sync_subgroup_upsert_arboles((select g from grupo_46),
       jsonb_build_array(pg_temp.arbol_46('b4600000-0000-0000-0000-0000000000d7', null)), 'P1') $$,
  '42501', null, 'upsert_arboles: árbol sin grupo');
select is((select count(*)::int from trees where id in (
    'b4600000-0000-0000-0000-0000000000d7', 'b4600000-0000-0000-0000-0000000000d8')),
  0, 'y no crea nada');

select * from finish();
rollback;
