-- El UPDATE directo de los campos editables de `plantations` está cerrado (063, #649):
-- se edita solo por `editar_plantacion`. `estado` conserva el UPDATE para finalizar.
begin;
select plan(17);

insert into organizations (id, nombre) values
  ('b4200000-0000-0000-0000-000000000001', 'Org Test 42');

insert into auth.users (id, email) values
  ('b4200000-0000-0000-0000-0000000000a1', 'admin-42@test.local');

update profiles set rol = 'admin', nombre = 'Admin 42', organizacion_id = 'b4200000-0000-0000-0000-000000000001'
  where id = 'b4200000-0000-0000-0000-0000000000a1';

select tests.crear_plantacion('b4200000-0000-0000-0000-000000000010', 'b4200000-0000-0000-0000-000000000001',
  'b4200000-0000-0000-0000-0000000000a1', 'Lote 42', p_objetivo_arboles => 100);
select tests.crear_plantacion('b4200000-0000-0000-0000-000000000011', 'b4200000-0000-0000-0000-000000000001',
  'b4200000-0000-0000-0000-0000000000a1', 'A finalizar 42');

create temp view plantacion_42 as
  select lugar, objetivo_arboles from plantations where id = 'b4200000-0000-0000-0000-000000000010';
grant select on plantacion_42 to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b4200000-0000-0000-0000-0000000000a1', true);

-- ── UPDATE directo ───────────────────────────────────────────────────────────

select throws_ok($$update plantations set lugar = 'X' where id = 'b4200000-0000-0000-0000-000000000010'$$,
  '42501', null, 'lugar no se cambia por UPDATE');
select throws_ok($$update plantations set periodo = '2027' where id = 'b4200000-0000-0000-0000-000000000010'$$,
  '42501', null, 'periodo no se cambia por UPDATE');
select throws_ok($$update plantations set descripcion = 'X' where id = 'b4200000-0000-0000-0000-000000000010'$$,
  '42501', null, 'descripcion no se cambia por UPDATE');
select throws_ok($$update plantations set fecha_inicio = '2026-01-01' where id = 'b4200000-0000-0000-0000-000000000010'$$,
  '42501', null, 'fecha_inicio no se cambia por UPDATE');
select throws_ok($$update plantations set objetivo_arboles = 1 where id = 'b4200000-0000-0000-0000-000000000010'$$,
  '42501', null, 'objetivo_arboles no se cambia por UPDATE');
select throws_ok($$update plantations set gps_capture_frequency = 5 where id = 'b4200000-0000-0000-0000-000000000010'$$,
  '42501', null, 'gps_capture_frequency no se cambia por UPDATE');
select throws_ok($$update plantations set gps_capture_required = true where id = 'b4200000-0000-0000-0000-000000000010'$$,
  '42501', null, 'gps_capture_required no se cambia por UPDATE');
select throws_ok($$update plantations set photo_capture_all_trees = true where id = 'b4200000-0000-0000-0000-000000000010'$$,
  '42501', null, 'photo_capture_all_trees no se cambia por UPDATE');
select throws_ok($$update plantations set visible_in_app = false where id = 'b4200000-0000-0000-0000-000000000010'$$,
  '42501', null, 'visible_in_app no se cambia por UPDATE');
select throws_ok(
  $$update plantations set estado = 'finalizada', lugar = 'X' where id = 'b4200000-0000-0000-0000-000000000010'$$,
  '42501', null, 'un UPDATE que mezcla estado con un campo editable falla entero');
select is((select lugar from plantacion_42), 'Lote 42', 'ningún UPDATE directo dejó cambios');

select lives_ok(
  $$update plantations set estado = 'finalizada' where id = 'b4200000-0000-0000-0000-000000000011'$$,
  'finalizar (activa → finalizada) sigue siendo un UPDATE');

-- ── editar_plantacion sigue funcionando ──────────────────────────────────────

select is(
  editar_plantacion('b4200000-0000-0000-0000-000000000010',
    '{"lugar": "Lote 42 editado", "objetivo_arboles": 200}', '{"lugar": "Lote 42", "objetivo_arboles": 100}'),
  '{"success": true}'::jsonb, 'editar_plantacion aplica los cambios con el UPDATE directo cerrado');
select is((select lugar from plantacion_42), 'Lote 42 editado', 'el lugar quedó guardado');

reset role;
select is(
  (select count(*)::int from unnest(array[
    'lugar', 'periodo', 'descripcion', 'fecha_inicio', 'objetivo_arboles',
    'gps_capture_frequency', 'gps_capture_required', 'photo_capture_all_trees', 'visible_in_app'
  ]) as c where has_column_privilege('authenticated', 'public.plantations', c, 'UPDATE')),
  0, 'authenticated no tiene UPDATE sobre ninguna de las columnas editables');
select ok(has_column_privilege('authenticated', 'public.plantations', 'estado', 'UPDATE'),
  'authenticated conserva UPDATE sobre estado');
select is(
  (select count(*)::int from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'plantations'
      and has_column_privilege('anon', 'public.plantations', c.column_name, 'UPDATE')),
  0, 'anon no tiene UPDATE sobre ninguna columna');

select * from finish();
rollback;
