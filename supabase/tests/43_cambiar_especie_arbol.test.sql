-- Cambiar la especie de un árbol (065, #679). `cambiar_especie_arbol`: aplica y
-- rearma el SubID si el server conserva la base, detecta el conflicto, acepta la
-- especie que el árbol ya tiene, exige especie habilitada, admin de la
-- organización y plantación escribible (una finalizada solo para superadmin).
-- `sync_subgroup` conserva la especie del server si difiere de la base que manda
-- el móvil, y devuelve en `conservadas` los árboles que quedaron con otra especie.
-- `conservados` (075) lo cubre el test 58.
begin;
select plan(29);

insert into organizations (id, nombre) values
  ('b4300000-0000-0000-0000-000000000001', 'Org Test 43'),
  ('b4300000-0000-0000-0000-000000000009', 'Otra Org 43');

insert into auth.users (id, email) values
  ('b4300000-0000-0000-0000-0000000000a1', 'admin-43@test.local'),
  ('b4300000-0000-0000-0000-0000000000a2', 'tecnico-43@test.local'),
  ('b4300000-0000-0000-0000-0000000000a3', 'super-43@test.local'),
  ('b4300000-0000-0000-0000-0000000000a4', 'ajeno-43@test.local'),
  ('b4300000-0000-0000-0000-0000000000a5', 'admin-otra-43@test.local'),
  ('b4300000-0000-0000-0000-0000000000a6', 'admin-sin-asignar-43@test.local');

update profiles set rol = 'admin', organizacion_id = 'b4300000-0000-0000-0000-000000000001'
  where id = 'b4300000-0000-0000-0000-0000000000a1';
update profiles set organizacion_id = 'b4300000-0000-0000-0000-000000000001'
  where id in ('b4300000-0000-0000-0000-0000000000a2', 'b4300000-0000-0000-0000-0000000000a4');
update profiles set rol = 'superadmin', organizacion_id = 'b4300000-0000-0000-0000-000000000001'
  where id = 'b4300000-0000-0000-0000-0000000000a3';
update profiles set rol = 'admin', organizacion_id = 'b4300000-0000-0000-0000-000000000009'
  where id = 'b4300000-0000-0000-0000-0000000000a5';
-- Admin de la organización sin asignar a ninguna plantación.
update profiles set rol = 'admin', organizacion_id = 'b4300000-0000-0000-0000-000000000001'
  where id = 'b4300000-0000-0000-0000-0000000000a6';

select tests.crear_plantacion('b4300000-0000-0000-0000-000000000002', 'b4300000-0000-0000-0000-000000000001',
  'b4300000-0000-0000-0000-0000000000a1', 'Activa 43');
select tests.crear_plantacion('b4300000-0000-0000-0000-000000000003', 'b4300000-0000-0000-0000-000000000001',
  'b4300000-0000-0000-0000-0000000000a1', 'Finalizada 43', p_estado => 'finalizada');
select tests.crear_plantacion('b4300000-0000-0000-0000-000000000004', 'b4300000-0000-0000-0000-000000000001',
  'b4300000-0000-0000-0000-0000000000a1', 'Archivada 43');
update plantations set archivada_en = now(), archivada_por = 'b4300000-0000-0000-0000-0000000000a1'
  where id = 'b4300000-0000-0000-0000-000000000004';

-- El ajeno es de la organización pero no está asignado a ninguna.
insert into plantation_users (plantation_id, user_id, rol_en_plantacion)
select p.id, u.id, u.rol
  from (values ('b4300000-0000-0000-0000-000000000002'::uuid),
               ('b4300000-0000-0000-0000-000000000003'::uuid),
               ('b4300000-0000-0000-0000-000000000004'::uuid)) as p(id)
  cross join (values ('b4300000-0000-0000-0000-0000000000a1'::uuid, 'admin'),
                     ('b4300000-0000-0000-0000-0000000000a2'::uuid, 'tecnico'),
                     ('b4300000-0000-0000-0000-0000000000a3'::uuid, 'admin')) as u(id, rol)
on conflict (plantation_id, user_id) do nothing;

insert into species (id, codigo, nombre) values
  ('b4300000-0000-0000-0000-0000000000e1', 'T43A', 'Alamo 43'),
  ('b4300000-0000-0000-0000-0000000000e2', 'T43B', 'Ceibo 43'),
  ('b4300000-0000-0000-0000-0000000000e3', 'T43C', 'Tala 43');

-- La tercera especie no está habilitada en ninguna.
insert into plantation_species (plantation_id, species_id, orden_visual)
select p.id, s.id, 0
  from (values ('b4300000-0000-0000-0000-000000000002'::uuid),
               ('b4300000-0000-0000-0000-000000000003'::uuid),
               ('b4300000-0000-0000-0000-000000000004'::uuid)) as p(id)
  cross join (values ('b4300000-0000-0000-0000-0000000000e1'::uuid),
                     ('b4300000-0000-0000-0000-0000000000e2'::uuid)) as s(id);

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b4300000-0000-0000-0000-0000000000b2', 'b4300000-0000-0000-0000-000000000002', 'Norte', 'P1'),
  ('b4300000-0000-0000-0000-0000000000b3', 'b4300000-0000-0000-0000-000000000003', 'Norte', 'P1'),
  ('b4300000-0000-0000-0000-0000000000b4', 'b4300000-0000-0000-0000-000000000004', 'Norte', 'P1');

insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, estado, usuario_creador) values
  ('b4300000-0000-0000-0000-0000000000c2', 'b4300000-0000-0000-0000-000000000002',
   'b4300000-0000-0000-0000-0000000000b2', 'Uno', 'L1', 'linea', 'finalizada', 'b4300000-0000-0000-0000-0000000000a2'),
  ('b4300000-0000-0000-0000-0000000000c3', 'b4300000-0000-0000-0000-000000000003',
   'b4300000-0000-0000-0000-0000000000b3', 'Uno', 'L1', 'linea', 'finalizada', 'b4300000-0000-0000-0000-0000000000a2'),
  ('b4300000-0000-0000-0000-0000000000c4', 'b4300000-0000-0000-0000-000000000004',
   'b4300000-0000-0000-0000-0000000000b4', 'Uno', 'L1', 'linea', 'finalizada', 'b4300000-0000-0000-0000-0000000000a2');

insert into trees (id, group_id, species_id, posicion, sub_id, usuario_registro) values
  ('b4300000-0000-0000-0000-0000000000d1', 'b4300000-0000-0000-0000-0000000000c2',
   'b4300000-0000-0000-0000-0000000000e1', 1, 'P1L1T43A1', 'b4300000-0000-0000-0000-0000000000a2'),
  ('b4300000-0000-0000-0000-0000000000d2', 'b4300000-0000-0000-0000-0000000000c2',
   'b4300000-0000-0000-0000-0000000000e1', 2, 'P1L1T43A2', 'b4300000-0000-0000-0000-0000000000a2'),
  ('b4300000-0000-0000-0000-0000000000d3', 'b4300000-0000-0000-0000-0000000000c3',
   'b4300000-0000-0000-0000-0000000000e1', 1, 'P1L1T43A1', 'b4300000-0000-0000-0000-0000000000a2'),
  ('b4300000-0000-0000-0000-0000000000d4', 'b4300000-0000-0000-0000-0000000000c4',
   'b4300000-0000-0000-0000-0000000000e1', 1, 'P1L1T43A1', 'b4300000-0000-0000-0000-0000000000a2'),
  ('b4300000-0000-0000-0000-0000000000d5', 'b4300000-0000-0000-0000-0000000000c2',
   'b4300000-0000-0000-0000-0000000000e1', 3, 'P1L1T43A3', 'b4300000-0000-0000-0000-0000000000a2'),
  ('b4300000-0000-0000-0000-0000000000d6', 'b4300000-0000-0000-0000-0000000000c2',
   'b4300000-0000-0000-0000-0000000000e1', 4, 'P1L1T43A4', 'b4300000-0000-0000-0000-0000000000a2'),
  ('b4300000-0000-0000-0000-0000000000d7', 'b4300000-0000-0000-0000-0000000000c2',
   null, 5, 'P1L1NN5', 'b4300000-0000-0000-0000-0000000000a2');

select ok(not has_function_privilege('anon', 'cambiar_especie_arbol(uuid, uuid, uuid)', 'execute'),
  'anon no ejecuta cambiar_especie_arbol');

set local role authenticated;

-- ── cambiar_especie_arbol ────────────────────────────────────────────────────

select set_config('request.jwt.claim.sub', 'b4300000-0000-0000-0000-0000000000a1', true);

select is(
  ( select cambiar_especie_arbol('b4300000-0000-0000-0000-0000000000d1',
      'b4300000-0000-0000-0000-0000000000e2', 'b4300000-0000-0000-0000-0000000000e1') ),
  '{"success": true, "sub_id": "P1L1T43B1"}'::jsonb,
  'con la base vigente aplica el cambio y devuelve el SubID nuevo');

select is(
  ( select cambiar_especie_arbol('b4300000-0000-0000-0000-0000000000d1',
      'b4300000-0000-0000-0000-0000000000e1', 'b4300000-0000-0000-0000-0000000000e1') ),
  '{"success": false, "error": "CONFLICTO_EDICION", "species_id": "b4300000-0000-0000-0000-0000000000e2", "codigo": "T43B", "nombre": "Ceibo 43", "sub_id": "P1L1T43B1"}'::jsonb,
  'con una base vieja devuelve el conflicto con la especie del server');

select is(
  ( select cambiar_especie_arbol('b4300000-0000-0000-0000-0000000000d1',
      'b4300000-0000-0000-0000-0000000000e2', 'b4300000-0000-0000-0000-0000000000e1') ->> 'success' ),
  'true',
  'elegir la especie que el árbol ya tiene es éxito aunque la base sea vieja');

select is(
  ( select cambiar_especie_arbol('b4300000-0000-0000-0000-0000000000d2',
      'b4300000-0000-0000-0000-0000000000e3', 'b4300000-0000-0000-0000-0000000000e1') ->> 'error' ),
  'ESPECIE_NO_HABILITADA',
  'una especie que no está en la plantación se rechaza');

select is(
  ( select cambiar_especie_arbol('b4300000-0000-0000-0000-0000000000d2',
      null, 'b4300000-0000-0000-0000-0000000000e1') ->> 'error' ),
  'ESPECIE_NO_HABILITADA',
  'pasar a N/N no está permitido');

select is(
  ( select cambiar_especie_arbol('b4300000-0000-0000-0000-0000000000d3',
      'b4300000-0000-0000-0000-0000000000e2', 'b4300000-0000-0000-0000-0000000000e1') ->> 'error' ),
  'PLANTACION_FINALIZADA',
  'el admin no cambia en una plantación finalizada');

select is(
  ( select cambiar_especie_arbol('b4300000-0000-0000-0000-0000000000d7',
      'b4300000-0000-0000-0000-0000000000e2', null) ->> 'sub_id' ),
  'P1L1T43B5',
  'un N/N se resuelve con base null');

select set_config('request.jwt.claim.sub', 'b4300000-0000-0000-0000-0000000000a2', true);
select is(
  ( select cambiar_especie_arbol('b4300000-0000-0000-0000-0000000000d2',
      'b4300000-0000-0000-0000-0000000000e2', 'b4300000-0000-0000-0000-0000000000e1') ->> 'error' ),
  'NOT_AUTHORIZED',
  'un técnico asignado no puede: desde el móvil cambia por sync_subgroup');

select set_config('request.jwt.claim.sub', 'b4300000-0000-0000-0000-0000000000a3', true);
select is(
  ( select cambiar_especie_arbol('b4300000-0000-0000-0000-0000000000d3',
      'b4300000-0000-0000-0000-0000000000e2', 'b4300000-0000-0000-0000-0000000000e1') ->> 'success' ),
  'true',
  'el superadmin cambia en una plantación finalizada');
select is(
  ( select cambiar_especie_arbol('b4300000-0000-0000-0000-0000000000d4',
      'b4300000-0000-0000-0000-0000000000e2', 'b4300000-0000-0000-0000-0000000000e1') ->> 'error' ),
  'PLANTACION_ARCHIVADA',
  'nadie cambia en una archivada, ni el superadmin');

select set_config('request.jwt.claim.sub', 'b4300000-0000-0000-0000-0000000000a4', true);
select is(
  ( select cambiar_especie_arbol('b4300000-0000-0000-0000-0000000000d5',
      'b4300000-0000-0000-0000-0000000000e2', 'b4300000-0000-0000-0000-0000000000e1') ->> 'error' ),
  'NOT_AUTHORIZED',
  'un técnico no asignado tampoco puede');

select set_config('request.jwt.claim.sub', 'b4300000-0000-0000-0000-0000000000a6', true);
select is(
  ( select cambiar_especie_arbol('b4300000-0000-0000-0000-0000000000d2',
      'b4300000-0000-0000-0000-0000000000e2', 'b4300000-0000-0000-0000-0000000000e1') ->> 'success' ),
  'true',
  'un admin de la organización no asignado puede, como en editar_plantacion');

select set_config('request.jwt.claim.sub', 'b4300000-0000-0000-0000-0000000000a5', true);
select is(
  ( select cambiar_especie_arbol('b4300000-0000-0000-0000-0000000000d5',
      'b4300000-0000-0000-0000-0000000000e2', 'b4300000-0000-0000-0000-0000000000e1') ->> 'error' ),
  'NOT_AUTHORIZED',
  'el admin de otra organización no puede');
select set_config('request.jwt.claim.sub', 'b4300000-0000-0000-0000-0000000000a4', true);
select is(
  ( select cambiar_especie_arbol('b4300000-0000-0000-0000-0000000000ff',
      'b4300000-0000-0000-0000-0000000000e2', null) ->> 'error' ),
  'NOT_AUTHORIZED',
  'un árbol inexistente da lo mismo que uno ajeno');

reset role;

select is((select species_id from trees where id = 'b4300000-0000-0000-0000-0000000000d1'),
  'b4300000-0000-0000-0000-0000000000e2'::uuid, 'el árbol quedó con la especie nueva');
select is((select sub_id from trees where id = 'b4300000-0000-0000-0000-0000000000d3'),
  'P1L1T43B1', 'el SubID se rearmó también en la finalizada');
select is((select species_id from trees where id = 'b4300000-0000-0000-0000-0000000000d4'),
  'b4300000-0000-0000-0000-0000000000e1'::uuid, 'el rechazado no cambió');
select is((select species_id from trees where id = 'b4300000-0000-0000-0000-0000000000d5'),
  'b4300000-0000-0000-0000-0000000000e1'::uuid, 'el ajeno tampoco');

-- ── sync_subgroup con especie base ───────────────────────────────────────────

-- La web pasó d5 a Ceibo; el móvil la vio como Alamo y sube un cambio a Tala.
update trees set species_id = 'b4300000-0000-0000-0000-0000000000e2', sub_id = 'P1L1T43B3'
  where id = 'b4300000-0000-0000-0000-0000000000d5';
-- d6 no cambió en la web: el cambio del móvil entra. d7 ya es Ceibo en el server.
insert into plantation_species (plantation_id, species_id, orden_visual) values
  ('b4300000-0000-0000-0000-000000000002', 'b4300000-0000-0000-0000-0000000000e3', 0);

create temp table arbol_43 as select jsonb_build_object(
  'subgroup_id', 'b4300000-0000-0000-0000-0000000000c2',
  'usuario_registro', 'b4300000-0000-0000-0000-0000000000a2',
  'created_at', now()
) as base;
create temp table grupo_43 as select jsonb_build_object(
  'id', 'b4300000-0000-0000-0000-0000000000c2',
  'plantation_id', 'b4300000-0000-0000-0000-000000000002',
  'parcela_id', 'b4300000-0000-0000-0000-0000000000b2',
  'nombre', 'Uno', 'codigo', 'L1', 'tipo', 'linea', 'estado', 'finalizada',
  'usuario_creador', 'b4300000-0000-0000-0000-0000000000a2',
  'created_at', now(), 'parcela_codigo', 'P1'
) as g;
grant select on arbol_43, grupo_43 to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b4300000-0000-0000-0000-0000000000a2', true);

select is(
  ( select sync_subgroup((select g from grupo_43), jsonb_build_array(
      (select base from arbol_43) || jsonb_build_object('id', 'b4300000-0000-0000-0000-0000000000d5',
        'posicion', 3, 'sub_id', 'P1L1T43C3',
        'species_id', 'b4300000-0000-0000-0000-0000000000e3',
        'species_base_id', 'b4300000-0000-0000-0000-0000000000e1'),
      (select base from arbol_43) || jsonb_build_object('id', 'b4300000-0000-0000-0000-0000000000d6',
        'posicion', 4, 'sub_id', 'P1L1T43C4',
        'species_id', 'b4300000-0000-0000-0000-0000000000e3',
        'species_base_id', 'b4300000-0000-0000-0000-0000000000e1'),
      -- Un N/N del móvil con base null: en el server ya está resuelto.
      (select base from arbol_43) || jsonb_build_object('id', 'b4300000-0000-0000-0000-0000000000d7',
        'posicion', 5, 'sub_id', 'P1L1NN5',
        'species_id', null, 'species_base_id', null)
    )) - 'conservados' ),
  '{"success": true, "conservadas": [{"id": "b4300000-0000-0000-0000-0000000000d5", "species_id": "b4300000-0000-0000-0000-0000000000e2"}, {"id": "b4300000-0000-0000-0000-0000000000d7", "species_id": "b4300000-0000-0000-0000-0000000000e2"}]}'::jsonb,
  'sync_subgroup devuelve los árboles que quedaron con la especie del server, también un N/N ya resuelto');

reset role;

select is((select species_id from trees where id = 'b4300000-0000-0000-0000-0000000000d5'),
  'b4300000-0000-0000-0000-0000000000e2'::uuid,
  'un cambio del server que el móvil no vio no se revierte');
select is((select sub_id from trees where id = 'b4300000-0000-0000-0000-0000000000d5'),
  'P1L1T43B3', 'y el SubID lleva el código de la especie del server');
select is((select species_id from trees where id = 'b4300000-0000-0000-0000-0000000000d6'),
  'b4300000-0000-0000-0000-0000000000e3'::uuid,
  'con la base vigente el cambio del móvil entra');
select is((select species_id from trees where id = 'b4300000-0000-0000-0000-0000000000d7'),
  'b4300000-0000-0000-0000-0000000000e2'::uuid,
  'un N/N desactualizado no deshace la resolución del server');

-- El push manda todo el grupo. d6 viaja sin tocar (especie = base, vieja) y el
-- server lo tiene en Tala: lo conserva y vuelve, para que el móvil lo adopte. d5
-- llega cambiado a la misma especie que ya tiene el server: no vuelve. d7 es un
-- N/N que el móvil resolvió (base null) y el server resolvió a otra: vuelve. Con un
-- código de parcela que el móvil todavía no conoce, el SubID conservado se pasa
-- al vigente igual que el que sube el móvil. `conservadas` sale ordenada por id.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b4300000-0000-0000-0000-0000000000a2', true);
select is(
  ( select sync_subgroup((select g || '{"parcela_codigo": "PX"}' from grupo_43), jsonb_build_array(
      (select base from arbol_43) || jsonb_build_object('id', 'b4300000-0000-0000-0000-0000000000d7',
        'posicion', 5, 'sub_id', 'PXL1T43A5',
        'species_id', 'b4300000-0000-0000-0000-0000000000e1', 'species_base_id', null),
      (select base from arbol_43) || jsonb_build_object('id', 'b4300000-0000-0000-0000-0000000000d6',
        'posicion', 4, 'sub_id', 'PXL1T43A4',
        'species_id', 'b4300000-0000-0000-0000-0000000000e1',
        'species_base_id', 'b4300000-0000-0000-0000-0000000000e1'),
      (select base from arbol_43) || jsonb_build_object('id', 'b4300000-0000-0000-0000-0000000000d5',
        'posicion', 3, 'sub_id', 'PXL1T43B3',
        'species_id', 'b4300000-0000-0000-0000-0000000000e2',
        'species_base_id', 'b4300000-0000-0000-0000-0000000000e1')
    )) - 'conservados' ),
  '{"success": true, "conservadas": [{"id": "b4300000-0000-0000-0000-0000000000d6", "species_id": "b4300000-0000-0000-0000-0000000000e3"}, {"id": "b4300000-0000-0000-0000-0000000000d7", "species_id": "b4300000-0000-0000-0000-0000000000e2"}]}'::jsonb,
  'vuelven un árbol sin cambiar y un N/N resuelto distinto; uno cambiado a la del server no');
reset role;
select is((select species_id from trees where id = 'b4300000-0000-0000-0000-0000000000d6'),
  'b4300000-0000-0000-0000-0000000000e3'::uuid, 'y el server conserva su especie');
select is((select sub_id from trees where id = 'b4300000-0000-0000-0000-0000000000d6'),
  'P1L1T43C4', 'el SubID conservado lleva el código de parcela vigente');

-- Un móvil viejo no manda la base: pisa como antes.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b4300000-0000-0000-0000-0000000000a2', true);
select is(
  ( select sync_subgroup((select g from grupo_43), jsonb_build_array(
      (select base from arbol_43) || jsonb_build_object('id', 'b4300000-0000-0000-0000-0000000000d5',
        'posicion', 3, 'sub_id', 'P1L1T43A3',
        'species_id', 'b4300000-0000-0000-0000-0000000000e1')
    )) - 'conservados' ),
  '{"success": true, "conservadas": []}'::jsonb,
  'sync_subgroup acepta un árbol sin especie base y no conserva nada');
reset role;
select is((select species_id from trees where id = 'b4300000-0000-0000-0000-0000000000d5'),
  'b4300000-0000-0000-0000-0000000000e1'::uuid,
  'sin base el móvil pisa la especie, como antes de 065');

select * from finish();
rollback;
