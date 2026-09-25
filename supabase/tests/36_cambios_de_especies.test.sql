-- aplicar_cambios_especies: altas y bajas idempotentes, una baja con árboles se
-- rechaza sola, orden alfabético, gates de 049; sync_subgroup re-habilita la
-- especie de los árboles que suben (058, #635).
begin;
select plan(17);

insert into organizations (id, nombre) values
  ('b3600000-0000-0000-0000-000000000001', 'Org Test 36'),
  ('b3600000-0000-0000-0000-000000000009', 'Otra Org 36');

insert into auth.users (id, email) values
  ('b3600000-0000-0000-0000-0000000000a1', 'admin-36@test.local'),
  ('b3600000-0000-0000-0000-0000000000a2', 'tecnico-36@test.local'),
  ('b3600000-0000-0000-0000-0000000000a3', 'admin-otra-36@test.local');

update profiles set rol = 'admin', organizacion_id = 'b3600000-0000-0000-0000-000000000001'
  where id = 'b3600000-0000-0000-0000-0000000000a1';
update profiles set organizacion_id = 'b3600000-0000-0000-0000-000000000001'
  where id = 'b3600000-0000-0000-0000-0000000000a2';
update profiles set rol = 'admin', organizacion_id = 'b3600000-0000-0000-0000-000000000009'
  where id = 'b3600000-0000-0000-0000-0000000000a3';

-- Nombres en otro orden que los códigos: el orden es por nombre.
insert into species (id, codigo, nombre) values
  ('b3600000-0000-0000-0000-0000000000e1', 'T36Z', 'Alamo 36'),
  ('b3600000-0000-0000-0000-0000000000e2', 'T36Y', 'Ceibo 36'),
  ('b3600000-0000-0000-0000-0000000000e3', 'T36X', 'Brachichito 36'),
  ('b3600000-0000-0000-0000-0000000000e4', 'T36W', 'Durazno 36');

insert into plantations (id, organizacion_id, lugar, periodo, creado_por, estado) values
  ('b3600000-0000-0000-0000-000000000002', 'b3600000-0000-0000-0000-000000000001',
   'Activa 36', '2026', 'b3600000-0000-0000-0000-0000000000a1', 'activa'),
  ('b3600000-0000-0000-0000-000000000003', 'b3600000-0000-0000-0000-000000000001',
   'Finalizada 36', '2026', 'b3600000-0000-0000-0000-0000000000a1', 'finalizada');

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b3600000-0000-0000-0000-000000000002', 'b3600000-0000-0000-0000-0000000000a2', 'tecnico');

insert into plantation_species (plantation_id, species_id, orden_visual) values
  ('b3600000-0000-0000-0000-000000000002', 'b3600000-0000-0000-0000-0000000000e1', 0),
  ('b3600000-0000-0000-0000-000000000002', 'b3600000-0000-0000-0000-0000000000e2', 1);

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b3600000-0000-0000-0000-0000000000b1', 'b3600000-0000-0000-0000-000000000002', 'Norte', 'P1');

insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador) values
  ('b3600000-0000-0000-0000-0000000000c1', 'b3600000-0000-0000-0000-000000000002',
   'b3600000-0000-0000-0000-0000000000b1', 'Uno', 'L1', 'linea', 'b3600000-0000-0000-0000-0000000000a1');

-- e1 tiene árboles: su baja se rechaza.
insert into trees (id, group_id, species_id, posicion, sub_id, usuario_registro) values
  ('b3600000-0000-0000-0000-0000000000d1', 'b3600000-0000-0000-0000-0000000000c1',
   'b3600000-0000-0000-0000-0000000000e1', 1, 'P1L1T36Z1', 'b3600000-0000-0000-0000-0000000000a1');

create temp view especies_36 as
  select species_id, orden_visual from plantation_species
  where plantation_id = 'b3600000-0000-0000-0000-000000000002';
grant select on especies_36 to authenticated;

create temp view ids_36 as
  select array_agg(species_id order by orden_visual) as ids from especies_36;
grant select on ids_36 to authenticated;

set local role authenticated;

-- ── Gates ────────────────────────────────────────────────────────────────────

select set_config('request.jwt.claim.sub', 'b3600000-0000-0000-0000-0000000000a2', true);
select is(
  (select aplicar_cambios_especies('b3600000-0000-0000-0000-000000000002',
    array['b3600000-0000-0000-0000-0000000000e3']::uuid[], '{}') ->> 'error'),
  'NOT_AUTHORIZED', 'un técnico no cambia especies');

select set_config('request.jwt.claim.sub', 'b3600000-0000-0000-0000-0000000000a3', true);
select is(
  (select aplicar_cambios_especies('b3600000-0000-0000-0000-000000000002',
    array['b3600000-0000-0000-0000-0000000000e3']::uuid[], '{}') ->> 'error'),
  'NOT_AUTHORIZED', 'un admin de otra organización no cambia especies');

select set_config('request.jwt.claim.sub', 'b3600000-0000-0000-0000-0000000000a1', true);
select is(
  (select aplicar_cambios_especies('b3600000-0000-0000-0000-000000000003',
    array['b3600000-0000-0000-0000-0000000000e3']::uuid[], '{}') ->> 'error'),
  'PLANTACION_FINALIZADA', 'una finalizada no admite cambios de especies');
select is((select count(*)::int from especies_36), 2, 'los rechazos no tocan nada');

-- ── Altas y bajas ────────────────────────────────────────────────────────────

select is(
  (select aplicar_cambios_especies('b3600000-0000-0000-0000-000000000002',
    array['b3600000-0000-0000-0000-0000000000e3']::uuid[],
    array['b3600000-0000-0000-0000-0000000000e2']::uuid[])),
  '{"success": true, "rechazadas": []}'::jsonb, 'alta y baja sin árboles se aplican');
select is((select ids from ids_36),
  array['b3600000-0000-0000-0000-0000000000e1', 'b3600000-0000-0000-0000-0000000000e3']::uuid[],
  'quedan las esperadas, en orden alfabético por nombre');

select is(
  (select aplicar_cambios_especies('b3600000-0000-0000-0000-000000000002',
    array['b3600000-0000-0000-0000-0000000000e3']::uuid[],
    array['b3600000-0000-0000-0000-0000000000e2']::uuid[])),
  '{"success": true, "rechazadas": []}'::jsonb, 'repetir el mismo cambio no falla');
select is((select count(*)::int from especies_36), 2, 'y deja todo igual');

-- Web y teléfono cambian especies distintas: se aplican los dos.
select aplicar_cambios_especies('b3600000-0000-0000-0000-000000000002',
  array['b3600000-0000-0000-0000-0000000000e4']::uuid[], '{}');
select aplicar_cambios_especies('b3600000-0000-0000-0000-000000000002',
  array['b3600000-0000-0000-0000-0000000000e2']::uuid[], '{}');
select is((select ids from ids_36),
  array['b3600000-0000-0000-0000-0000000000e1', 'b3600000-0000-0000-0000-0000000000e3',
        'b3600000-0000-0000-0000-0000000000e2', 'b3600000-0000-0000-0000-0000000000e4']::uuid[],
  'dos cambios en especies distintas conviven, con orden_visual alfabético');

select is(
  (select aplicar_cambios_especies('b3600000-0000-0000-0000-000000000002', '{}',
    array['b3600000-0000-0000-0000-0000000000e1', 'b3600000-0000-0000-0000-0000000000e4']::uuid[])),
  '{"success": true, "rechazadas": [{"species_id": "b3600000-0000-0000-0000-0000000000e1", "error": "ESPECIE_CON_ARBOLES"}]}'::jsonb,
  'la baja con árboles se rechaza sola');
select is((select ids from ids_36),
  array['b3600000-0000-0000-0000-0000000000e1', 'b3600000-0000-0000-0000-0000000000e3',
        'b3600000-0000-0000-0000-0000000000e2']::uuid[],
  'la especie con árboles sigue y la otra baja se aplicó');

select is(
  (select aplicar_cambios_especies('b3600000-0000-0000-0000-000000000002',
    array['b3600000-0000-0000-0000-0000000000f9']::uuid[], '{}') -> 'rechazadas' -> 0 ->> 'error'),
  'ESPECIE_INEXISTENTE', 'el alta de una especie que no existe se rechaza');

select is(
  (select aplicar_cambios_especies('b3600000-0000-0000-0000-000000000002',
    array['b3600000-0000-0000-0000-0000000000e4']::uuid[],
    array['b3600000-0000-0000-0000-0000000000e4']::uuid[]) ->> 'success'),
  'true', 'una especie en las dos listas');
select is((select count(*)::int from especies_36 where species_id = 'b3600000-0000-0000-0000-0000000000e4'),
  1, 'cuenta como alta');

-- ── sync_subgroup re-habilita ────────────────────────────────────────────────

select aplicar_cambios_especies('b3600000-0000-0000-0000-000000000002', '{}',
  array['b3600000-0000-0000-0000-0000000000e2']::uuid[]);

select set_config('request.jwt.claim.sub', 'b3600000-0000-0000-0000-0000000000a2', true);
select is(
  ( select sync_subgroup(
      jsonb_build_object(
        'id', 'b3600000-0000-0000-0000-0000000000c1',
        'plantation_id', 'b3600000-0000-0000-0000-000000000002',
        'parcela_id', 'b3600000-0000-0000-0000-0000000000b1',
        'nombre', 'Uno', 'codigo', 'L1', 'tipo', 'linea', 'estado', 'finalizada',
        'usuario_creador', 'b3600000-0000-0000-0000-0000000000a1', 'created_at', now()),
      jsonb_build_array(
        jsonb_build_object('id', 'b3600000-0000-0000-0000-0000000000d2',
          'group_id', 'b3600000-0000-0000-0000-0000000000c1', 'posicion', 2,
          'species_id', 'b3600000-0000-0000-0000-0000000000e2',
          'sub_id', 'P1L1T36Y2', 'usuario_registro', 'b3600000-0000-0000-0000-0000000000a2',
          'created_at', now()),
        jsonb_build_object('id', 'b3600000-0000-0000-0000-0000000000d3',
          'group_id', 'b3600000-0000-0000-0000-0000000000c1', 'posicion', 3,
          'sub_id', 'P1L1NN3', 'usuario_registro', 'b3600000-0000-0000-0000-0000000000a2',
          'created_at', now())
      )
    ) ->> 'success' ),
  'true', 'sync_subgroup acepta árboles de una especie quitada');
select is((select ids from ids_36),
  array['b3600000-0000-0000-0000-0000000000e1', 'b3600000-0000-0000-0000-0000000000e3',
        'b3600000-0000-0000-0000-0000000000e2', 'b3600000-0000-0000-0000-0000000000e4']::uuid[],
  'la especie vuelve a estar habilitada, en su lugar alfabético');

-- ── Colación ─────────────────────────────────────────────────────────────────

reset role;
insert into species (id, codigo, nombre) values
  ('b3600000-0000-0000-0000-0000000000e5', 'T36V', 'Álamo blanco 36'),
  ('b3600000-0000-0000-0000-0000000000e6', 'T36U', 'aromo 36'),
  ('b3600000-0000-0000-0000-0000000000e7', 'T36T', 'Zarzamora 36');
insert into plantation_species (plantation_id, species_id, orden_visual) values
  ('b3600000-0000-0000-0000-000000000003', 'b3600000-0000-0000-0000-0000000000e7', 0),
  ('b3600000-0000-0000-0000-000000000003', 'b3600000-0000-0000-0000-0000000000e6', 1),
  ('b3600000-0000-0000-0000-000000000003', 'b3600000-0000-0000-0000-0000000000e5', 2);
select ordenar_especies_plantacion('b3600000-0000-0000-0000-000000000003');
select is(
  (select array_agg(species_id order by orden_visual) from plantation_species
    where plantation_id = 'b3600000-0000-0000-0000-000000000003'),
  array['b3600000-0000-0000-0000-0000000000e5', 'b3600000-0000-0000-0000-0000000000e6',
        'b3600000-0000-0000-0000-0000000000e7']::uuid[],
  'acentos y minúsculas en su lugar: Álamo, aromo, Zarzamora');

select * from finish();
rollback;
