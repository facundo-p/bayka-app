-- Una especie con árboles no se quita de su plantación, ni por DELETE ni por
-- reemplazar_especies_plantacion; el reemplazo conserva las que siguen y el
-- borrado de la plantación sigue pasando (055, #632).
begin;
select plan(8);

insert into organizations (id, nombre) values
  ('b3300000-0000-0000-0000-000000000001', 'Org Test 33');

insert into auth.users (id, email) values
  ('b3300000-0000-0000-0000-0000000000a1', 'admin-33@test.local');

update profiles set rol = 'admin', organizacion_id = 'b3300000-0000-0000-0000-000000000001'
  where id = 'b3300000-0000-0000-0000-0000000000a1';

insert into species (id, codigo, nombre) values
  ('b3300000-0000-0000-0000-0000000000e1', 'T33A', 'Con árboles 33'),
  ('b3300000-0000-0000-0000-0000000000e2', 'T33B', 'Sin árboles 33'),
  ('b3300000-0000-0000-0000-0000000000e3', 'T33C', 'Otra sin árboles 33');

insert into plantations (id, organizacion_id, lugar, periodo, creado_por, estado) values
  ('b3300000-0000-0000-0000-000000000002', 'b3300000-0000-0000-0000-000000000001',
   'Activa 33', '2026', 'b3300000-0000-0000-0000-0000000000a1', 'activa');

insert into plantation_species (plantation_id, species_id, orden_visual) values
  ('b3300000-0000-0000-0000-000000000002', 'b3300000-0000-0000-0000-0000000000e1', 0),
  ('b3300000-0000-0000-0000-000000000002', 'b3300000-0000-0000-0000-0000000000e2', 1),
  ('b3300000-0000-0000-0000-000000000002', 'b3300000-0000-0000-0000-0000000000e3', 2);

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b3300000-0000-0000-0000-0000000000b1', 'b3300000-0000-0000-0000-000000000002', 'Norte', 'P1');

insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador) values
  ('b3300000-0000-0000-0000-0000000000c1', 'b3300000-0000-0000-0000-000000000002',
   'b3300000-0000-0000-0000-0000000000b1', 'Uno', 'L1', 'linea', 'b3300000-0000-0000-0000-0000000000a1');

insert into trees (id, group_id, species_id, posicion, sub_id, usuario_registro) values
  ('b3300000-0000-0000-0000-0000000000d1', 'b3300000-0000-0000-0000-0000000000c1',
   'b3300000-0000-0000-0000-0000000000e1', 1, 'P1L1T33A1', 'b3300000-0000-0000-0000-0000000000a1');

create temp view especies_33 as
  select species_id, orden_visual from plantation_species
  where plantation_id = 'b3300000-0000-0000-0000-000000000002';
grant select on especies_33 to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b3300000-0000-0000-0000-0000000000a1', true);

-- ── DELETE directo ───────────────────────────────────────────────────────────

select throws_ok(
  $$delete from plantation_species where plantation_id = 'b3300000-0000-0000-0000-000000000002'
    and species_id = 'b3300000-0000-0000-0000-0000000000e1'$$,
  '23001', 'ESPECIE_CON_ARBOLES', 'DELETE de una especie con árboles falla');

delete from plantation_species where plantation_id = 'b3300000-0000-0000-0000-000000000002'
  and species_id = 'b3300000-0000-0000-0000-0000000000e3';
select is((select count(*)::int from especies_33 where species_id = 'b3300000-0000-0000-0000-0000000000e3'),
  0, 'DELETE de una especie sin árboles pasa');

-- ── reemplazar_especies_plantacion ───────────────────────────────────────────

select is(
  (select reemplazar_especies_plantacion('b3300000-0000-0000-0000-000000000002',
    '[{"species_id": "b3300000-0000-0000-0000-0000000000e2", "orden_visual": 0}]') ->> 'error'),
  'ESPECIE_CON_ARBOLES', 'el reemplazo que deja afuera una especie con árboles se rechaza');
select is((select count(*)::int from especies_33), 2, 'el reemplazo rechazado no toca nada');

select is(
  (select reemplazar_especies_plantacion('b3300000-0000-0000-0000-000000000002',
    '[{"species_id": "b3300000-0000-0000-0000-0000000000e1", "orden_visual": 5}]') ->> 'success'),
  'true', 'el reemplazo que conserva la especie con árboles y quita otra pasa');
select is((select orden_visual from especies_33 where species_id = 'b3300000-0000-0000-0000-0000000000e1'),
  5, 'la especie conservada toma el orden nuevo');
select is((select count(*)::int from especies_33), 1, 'la especie sin árboles se quitó');

-- ── Borrar la plantación ─────────────────────────────────────────────────────

reset role;
select lives_ok(
  $$delete from plantations where id = 'b3300000-0000-0000-0000-000000000002'$$,
  'el cascade de borrar la plantación no choca con el guard');

select * from finish();
rollback;
