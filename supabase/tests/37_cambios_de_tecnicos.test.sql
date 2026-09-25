-- aplicar_cambios_tecnicos: altas y bajas idempotentes, gates de 049, un técnico
-- inactivo, de otra organización o que no es técnico se rechaza solo (059, #636).
begin;
select plan(18);

insert into organizations (id, nombre) values
  ('b3700000-0000-0000-0000-000000000001', 'Org Test 37'),
  ('b3700000-0000-0000-0000-000000000009', 'Otra Org 37');

insert into auth.users (id, email) values
  ('b3700000-0000-0000-0000-0000000000a1', 'admin-37@test.local'),
  ('b3700000-0000-0000-0000-0000000000a2', 'tecnico-uno-37@test.local'),
  ('b3700000-0000-0000-0000-0000000000a3', 'tecnico-dos-37@test.local'),
  ('b3700000-0000-0000-0000-0000000000a4', 'tecnico-inactivo-37@test.local'),
  ('b3700000-0000-0000-0000-0000000000a5', 'tecnico-otra-37@test.local'),
  ('b3700000-0000-0000-0000-0000000000a6', 'admin-otra-37@test.local');

update profiles set organizacion_id = 'b3700000-0000-0000-0000-000000000001'
  where id in ('b3700000-0000-0000-0000-0000000000a2', 'b3700000-0000-0000-0000-0000000000a3',
               'b3700000-0000-0000-0000-0000000000a4');
update profiles set rol = 'admin', organizacion_id = 'b3700000-0000-0000-0000-000000000001'
  where id = 'b3700000-0000-0000-0000-0000000000a1';
update profiles set organizacion_id = 'b3700000-0000-0000-0000-000000000009'
  where id = 'b3700000-0000-0000-0000-0000000000a5';
update profiles set rol = 'admin', organizacion_id = 'b3700000-0000-0000-0000-000000000009'
  where id = 'b3700000-0000-0000-0000-0000000000a6';

-- 02: activa. 03: finalizada. 04: archivada. El trigger suma al admin como miembro.
insert into plantations (id, organizacion_id, lugar, periodo, creado_por, estado, archivada_en) values
  ('b3700000-0000-0000-0000-000000000002', 'b3700000-0000-0000-0000-000000000001',
   'Activa 37', '2026', 'b3700000-0000-0000-0000-0000000000a1', 'activa', null),
  ('b3700000-0000-0000-0000-000000000003', 'b3700000-0000-0000-0000-000000000001',
   'Finalizada 37', '2026', 'b3700000-0000-0000-0000-0000000000a1', 'finalizada', null),
  ('b3700000-0000-0000-0000-000000000004', 'b3700000-0000-0000-0000-000000000001',
   'Archivada 37', '2026', 'b3700000-0000-0000-0000-0000000000a1', 'activa', now());

-- Inactivo después de crear las plantaciones: no importa para el trigger de admins.
update profiles set activo = false where id = 'b3700000-0000-0000-0000-0000000000a4';

create temp view tecnicos_37 as
  select array_agg(user_id order by user_id) as ids from plantation_users
  where plantation_id = 'b3700000-0000-0000-0000-000000000002' and rol_en_plantacion = 'tecnico';
grant select on tecnicos_37 to authenticated;

create temp view admin_37 as
  select count(*)::int as n from plantation_users
  where plantation_id = 'b3700000-0000-0000-0000-000000000002'
    and user_id = 'b3700000-0000-0000-0000-0000000000a1' and rol_en_plantacion = 'admin';
grant select on admin_37 to authenticated;

set local role authenticated;

-- ── Gates ────────────────────────────────────────────────────────────────────

select set_config('request.jwt.claim.sub', 'b3700000-0000-0000-0000-0000000000a2', true);
select is(
  (select aplicar_cambios_tecnicos('b3700000-0000-0000-0000-000000000002',
    array['b3700000-0000-0000-0000-0000000000a3']::uuid[], '{}') ->> 'error'),
  'NOT_AUTHORIZED', 'un técnico no asigna');

select set_config('request.jwt.claim.sub', 'b3700000-0000-0000-0000-0000000000a6', true);
select is(
  (select aplicar_cambios_tecnicos('b3700000-0000-0000-0000-000000000002',
    array['b3700000-0000-0000-0000-0000000000a3']::uuid[], '{}') ->> 'error'),
  'NOT_AUTHORIZED', 'un admin de otra organización no asigna');

select set_config('request.jwt.claim.sub', 'b3700000-0000-0000-0000-0000000000a1', true);
select is(
  (select aplicar_cambios_tecnicos('b3700000-0000-0000-0000-000000000004',
    array['b3700000-0000-0000-0000-0000000000a3']::uuid[], '{}') ->> 'error'),
  'PLANTACION_ARCHIVADA', 'una archivada no admite asignaciones');
select is(
  (select aplicar_cambios_tecnicos('b3700000-0000-0000-0000-0000000000ff',
    array['b3700000-0000-0000-0000-0000000000a3']::uuid[], '{}') ->> 'error'),
  'PLANTACION_INEXISTENTE', 'una inexistente se informa como tal');
select is((select ids from tecnicos_37), null, 'los rechazos no tocan nada');

select is(
  (select aplicar_cambios_tecnicos('b3700000-0000-0000-0000-000000000003',
    array['b3700000-0000-0000-0000-0000000000a3']::uuid[], '{}')),
  '{"success": true, "rechazados": []}'::jsonb, 'una finalizada admite asignaciones');

-- ── Altas y bajas ────────────────────────────────────────────────────────────

select is(
  (select aplicar_cambios_tecnicos('b3700000-0000-0000-0000-000000000002',
    array['b3700000-0000-0000-0000-0000000000a2', 'b3700000-0000-0000-0000-0000000000a3']::uuid[], '{}')),
  '{"success": true, "rechazados": []}'::jsonb, 'las altas se aplican');
select is((select ids from tecnicos_37),
  array['b3700000-0000-0000-0000-0000000000a2', 'b3700000-0000-0000-0000-0000000000a3']::uuid[],
  'quedan los dos asignados');

select is(
  (select aplicar_cambios_tecnicos('b3700000-0000-0000-0000-000000000002',
    array['b3700000-0000-0000-0000-0000000000a2']::uuid[], '{}')),
  '{"success": true, "rechazados": []}'::jsonb, 'repetir un alta no falla');

-- Otro cliente asigna a uno solo: no quita al otro, como haría un reemplazo.
select aplicar_cambios_tecnicos('b3700000-0000-0000-0000-000000000002',
  array['b3700000-0000-0000-0000-0000000000a3']::uuid[], '{}');
select is((select ids from tecnicos_37),
  array['b3700000-0000-0000-0000-0000000000a2', 'b3700000-0000-0000-0000-0000000000a3']::uuid[],
  'un alta concurrente no pisa las demás');

select is(
  (select aplicar_cambios_tecnicos('b3700000-0000-0000-0000-000000000002',
    array['b3700000-0000-0000-0000-0000000000a4', 'b3700000-0000-0000-0000-0000000000a5']::uuid[], '{}')),
  '{"success": true, "rechazados": [
     {"user_id": "b3700000-0000-0000-0000-0000000000a4", "error": "TECNICO_INACTIVO"},
     {"user_id": "b3700000-0000-0000-0000-0000000000a5", "error": "USUARIO_DE_OTRA_ORGANIZACION"}]}'::jsonb,
  'un técnico inactivo o de otra organización se rechaza con su motivo');
select is((select ids from tecnicos_37),
  array['b3700000-0000-0000-0000-0000000000a2', 'b3700000-0000-0000-0000-0000000000a3']::uuid[],
  'y no se asigna');

-- a1 es admin: miembro por trigger, pero no se lo asigna como técnico.
select is(
  (select aplicar_cambios_tecnicos('b3700000-0000-0000-0000-000000000003',
    array['b3700000-0000-0000-0000-0000000000a1']::uuid[], '{}')),
  '{"success": true, "rechazados": [{"user_id": "b3700000-0000-0000-0000-0000000000a1", "error": "NO_ES_TECNICO"}]}'::jsonb,
  'un usuario que no es técnico se rechaza con su motivo');

select is(
  (select aplicar_cambios_tecnicos('b3700000-0000-0000-0000-000000000002',
    '{}', array['b3700000-0000-0000-0000-0000000000a2', 'b3700000-0000-0000-0000-0000000000a1']::uuid[])),
  '{"success": true, "rechazados": []}'::jsonb, 'la baja se aplica');
select is((select ids from tecnicos_37), array['b3700000-0000-0000-0000-0000000000a3']::uuid[],
  'quita solo al técnico');
select is((select n from admin_37), 1, 'la membresía admin no se toca');

select aplicar_cambios_tecnicos('b3700000-0000-0000-0000-000000000002',
  array['b3700000-0000-0000-0000-0000000000a2']::uuid[], array['b3700000-0000-0000-0000-0000000000a2']::uuid[]);
select is((select ids from tecnicos_37),
  array['b3700000-0000-0000-0000-0000000000a2', 'b3700000-0000-0000-0000-0000000000a3']::uuid[],
  'en las dos listas cuenta como alta');

reset role;
select ok(
  not has_function_privilege('anon', 'public.aplicar_cambios_tecnicos(uuid, uuid[], uuid[])', 'execute'),
  'anon no ejecuta el RPC');

select * from finish();
rollback;
