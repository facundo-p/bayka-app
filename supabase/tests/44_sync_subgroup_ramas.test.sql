-- Ramas de sync_subgroup sin otro test: re-sync de un árbol (pisa especie y
-- SubID, conserva foto, ids y GPS que no vienen), especie vacía como N/N, sin
-- reordenar si no habilita ninguna, y una excepción que deshace todo lo escrito
-- antes y responde UNKNOWN, también desde las validaciones, y DUPLICATE_CODE
-- antes que DUPLICATE_NAME. Fija el comportamiento al partir la función (#734).
begin;
select plan(19);

insert into organizations (id, nombre) values
  ('b4400000-0000-0000-0000-000000000001', 'Org Test 44');

insert into auth.users (id, email) values
  ('b4400000-0000-0000-0000-0000000000a1', 'tecnico-44@test.local');

update profiles set organizacion_id = 'b4400000-0000-0000-0000-000000000001'
  where id = 'b4400000-0000-0000-0000-0000000000a1';

insert into species (id, codigo, nombre) values
  ('b4400000-0000-0000-0000-0000000000e1', 'T44A', 'Acacia 44'),
  ('b4400000-0000-0000-0000-0000000000e2', 'T44B', 'Barba 44');

select tests.crear_plantacion('b4400000-0000-0000-0000-000000000002', 'b4400000-0000-0000-0000-000000000001',
  'b4400000-0000-0000-0000-0000000000a1', 'Activa 44');

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b4400000-0000-0000-0000-000000000002', 'b4400000-0000-0000-0000-0000000000a1', 'tecnico');

-- Orden no alfabético a propósito: solo se reordena si se habilita una especie.
insert into plantation_species (plantation_id, species_id, orden_visual) values
  ('b4400000-0000-0000-0000-000000000002', 'b4400000-0000-0000-0000-0000000000e2', 0),
  ('b4400000-0000-0000-0000-000000000002', 'b4400000-0000-0000-0000-0000000000e1', 1);

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b4400000-0000-0000-0000-0000000000b1', 'b4400000-0000-0000-0000-000000000002', 'Norte', 'P1');

create temp table grupo_44 as select jsonb_build_object(
  'id', 'b4400000-0000-0000-0000-0000000000c1',
  'plantation_id', 'b4400000-0000-0000-0000-000000000002',
  'parcela_id', 'b4400000-0000-0000-0000-0000000000b1',
  'parcela_codigo', 'P1',
  'nombre', 'Uno', 'codigo', 'L1', 'tipo', 'linea', 'estado', 'activa',
  'usuario_creador', 'b4400000-0000-0000-0000-0000000000a1',
  'created_at', now()
) as g;
grant select on grupo_44 to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b4400000-0000-0000-0000-0000000000a1', true);

select is(
  ( select sync_subgroup(
      (select g from grupo_44),
      jsonb_build_array(
        jsonb_build_object('id', 'b4400000-0000-0000-0000-0000000000d1',
          'group_id', 'b4400000-0000-0000-0000-0000000000c1', 'posicion', 1,
          'species_id', 'b4400000-0000-0000-0000-0000000000e1', 'sub_id', 'P1L1T44A1',
          'foto_url', 'fotos/d1.jpg', 'plantacion_id', 4401, 'global_id', 4402,
          'latitude', -34.5, 'longitude', -58.4, 'gps_accuracy', 5,
          'gps_captured_at', '2026-01-02T03:04:05Z',
          'usuario_registro', 'b4400000-0000-0000-0000-0000000000a1', 'created_at', now()),
        jsonb_build_object('id', 'b4400000-0000-0000-0000-0000000000d2',
          'group_id', 'b4400000-0000-0000-0000-0000000000c1', 'posicion', 2,
          'species_id', '', 'sub_id', 'P1L1NN2',
          'usuario_registro', 'b4400000-0000-0000-0000-0000000000a1', 'created_at', now())
      )
    ) ->> 'success' ),
  'true',
  'primer sync del grupo con sus árboles');

-- Re-sync: otra especie y SubID, otra posición, y sin foto, ids ni GPS.
select is(
  ( select sync_subgroup(
      (select g from grupo_44) || jsonb_build_object('estado', 'finalizada'),
      jsonb_build_array(
        jsonb_build_object('id', 'b4400000-0000-0000-0000-0000000000d1',
          'group_id', 'b4400000-0000-0000-0000-0000000000c1', 'posicion', 9,
          'species_id', 'b4400000-0000-0000-0000-0000000000e2', 'sub_id', 'P1L1T44B1',
          'usuario_registro', 'b4400000-0000-0000-0000-0000000000a1', 'created_at', now())
      )
    ) ->> 'success' ),
  'true',
  're-sync del mismo grupo y árbol');

-- Una excepción en los árboles deshace también el grupo ya insertado.
select is(
  ( select sync_subgroup(
      (select g from grupo_44) || jsonb_build_object(
        'id', 'b4400000-0000-0000-0000-0000000000c2', 'nombre', 'Dos', 'codigo', 'L2'),
      jsonb_build_array(
        jsonb_build_object('id', 'b4400000-0000-0000-0000-0000000000d3',
          'group_id', 'b4400000-0000-0000-0000-0000000000c2', 'posicion', 'no-es-numero',
          'species_id', 'b4400000-0000-0000-0000-0000000000e1', 'sub_id', 'P1L2T44A1',
          'usuario_registro', 'b4400000-0000-0000-0000-0000000000a1', 'created_at', now())
      )
    ) ->> 'error' ),
  'UNKNOWN',
  'un árbol inválido responde UNKNOWN');

select is(
  ( select sync_subgroup(
      ((select g from grupo_44) - 'parcela_id') || jsonb_build_object(
        'id', 'b4400000-0000-0000-0000-0000000000c3', 'nombre', 'Tres', 'codigo', 'L3'),
      '[]'::jsonb) ->> 'error' ),
  'UNKNOWN',
  'un grupo sin parcela_id responde UNKNOWN');

select is(
  ( select sync_subgroup((select g from grupo_44) || jsonb_build_object('plantation_id', 'no-es-uuid'),
      '[]'::jsonb) ->> 'error' ),
  'UNKNOWN',
  'un plantation_id inválido responde UNKNOWN');

select is(
  ( select sync_subgroup((select g from grupo_44) || jsonb_build_object(
      'id', 'b4400000-0000-0000-0000-0000000000c4'), '[]'::jsonb) ->> 'error' ),
  'DUPLICATE_CODE',
  'con código y nombre repetidos gana DUPLICATE_CODE');

reset role;

select is((select estado from groups where id = 'b4400000-0000-0000-0000-0000000000c1'),
  'finalizada', 'el re-sync pisa el estado del grupo');
select is((select species_id from trees where id = 'b4400000-0000-0000-0000-0000000000d1'),
  'b4400000-0000-0000-0000-0000000000e2'::uuid, 'el re-sync pisa la especie');
select is((select sub_id from trees where id = 'b4400000-0000-0000-0000-0000000000d1'),
  'P1L1T44B1', 'y el SubID');
select is((select posicion from trees where id = 'b4400000-0000-0000-0000-0000000000d1'),
  1, 'pero no la posición');
select is((select foto_url from trees where id = 'b4400000-0000-0000-0000-0000000000d1'),
  'fotos/d1.jpg', 'una foto que no viene se conserva');
select is((select (plantacion_id, global_id)::text from trees where id = 'b4400000-0000-0000-0000-0000000000d1'),
  '(4401,4402)', 'los ids que no vienen se conservan');
select is((select (latitude, longitude, gps_accuracy)::text from trees where id = 'b4400000-0000-0000-0000-0000000000d1'),
  '(-34.5,-58.4,5)', 'el GPS que no viene se conserva');
select is((select gps_captured_at from trees where id = 'b4400000-0000-0000-0000-0000000000d1'),
  '2026-01-02T03:04:05Z'::timestamptz, 'y su fecha');
select is((select species_id from trees where id = 'b4400000-0000-0000-0000-0000000000d2'),
  null, 'una especie vacía queda como N/N');
select is(
  (select array_agg(species_id order by orden_visual) from plantation_species
    where plantation_id = 'b4400000-0000-0000-0000-000000000002'),
  array['b4400000-0000-0000-0000-0000000000e2', 'b4400000-0000-0000-0000-0000000000e1']::uuid[],
  'sin especies que habilitar no se reordena ni se suma la vacía');
select is((select count(*)::int from groups where id = 'b4400000-0000-0000-0000-0000000000c2'),
  0, 'el grupo del sync fallido no quedó');
select is((select count(*)::int from trees where id = 'b4400000-0000-0000-0000-0000000000d3'),
  0, 'ni su árbol');
select is((select count(*)::int from groups where plantation_id = 'b4400000-0000-0000-0000-000000000002'),
  1, 'el grupo sin parcela_id tampoco');

select * from finish();
rollback;
