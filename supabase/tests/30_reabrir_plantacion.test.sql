-- reabrir_plantacion: solo superadmin activo de la organización (052, #470).
-- Los criterios del issue, en orden: reabre y la app vuelve a aceptar
-- escrituras; admin y técnico no pueden; un superadmin inactivo tampoco;
-- reabrir una activa no falla; y los grupos quedan como estaban.
begin;
select plan(12);

insert into organizations (id, nombre) values
  ('b3000000-0000-0000-0000-000000000001', 'Org Test 30'),
  ('b3000000-0000-0000-0000-000000000009', 'Otra Org 30');

insert into auth.users (id, email) values
  ('b3000000-0000-0000-0000-0000000000a1', 'super-30@test.local'),
  ('b3000000-0000-0000-0000-0000000000a2', 'admin-30@test.local'),
  ('b3000000-0000-0000-0000-0000000000a3', 'tecnico-30@test.local'),
  ('b3000000-0000-0000-0000-0000000000a4', 'super-inactivo-30@test.local'),
  ('b3000000-0000-0000-0000-0000000000a5', 'super-otra-org-30@test.local');

update profiles set rol = 'superadmin', organizacion_id = 'b3000000-0000-0000-0000-000000000001'
  where id = 'b3000000-0000-0000-0000-0000000000a1';
update profiles set rol = 'admin', organizacion_id = 'b3000000-0000-0000-0000-000000000001'
  where id = 'b3000000-0000-0000-0000-0000000000a2';
update profiles set organizacion_id = 'b3000000-0000-0000-0000-000000000001'
  where id = 'b3000000-0000-0000-0000-0000000000a3';
update profiles set rol = 'superadmin', activo = false,
  organizacion_id = 'b3000000-0000-0000-0000-000000000001'
  where id = 'b3000000-0000-0000-0000-0000000000a4';
update profiles set rol = 'superadmin', organizacion_id = 'b3000000-0000-0000-0000-000000000009'
  where id = 'b3000000-0000-0000-0000-0000000000a5';

insert into plantations (id, organizacion_id, lugar, periodo, creado_por, estado) values
  ('b3000000-0000-0000-0000-000000000002', 'b3000000-0000-0000-0000-000000000001',
   'Finalizada 30', '2026', 'b3000000-0000-0000-0000-0000000000a2', 'finalizada'),
  ('b3000000-0000-0000-0000-000000000003', 'b3000000-0000-0000-0000-000000000001',
   'Activa 30', '2026', 'b3000000-0000-0000-0000-0000000000a2', 'activa'),
  ('b3000000-0000-0000-0000-000000000004', 'b3000000-0000-0000-0000-000000000001',
   'Archivada 30', '2026', 'b3000000-0000-0000-0000-0000000000a2', 'finalizada');

update plantations set archivada_en = now(), archivada_por = 'b3000000-0000-0000-0000-0000000000a2'
  where id = 'b3000000-0000-0000-0000-000000000004';

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b3000000-0000-0000-0000-000000000005', 'b3000000-0000-0000-0000-000000000002', 'Norte', 'P-30');

insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, estado, usuario_creador) values
  ('b3000000-0000-0000-0000-000000000006', 'b3000000-0000-0000-0000-000000000002',
   'b3000000-0000-0000-0000-000000000005', 'Linea A', 'LA', 'linea', 'finalizada',
   'b3000000-0000-0000-0000-0000000000a3');

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b3000000-0000-0000-0000-000000000002', 'b3000000-0000-0000-0000-0000000000a3', 'tecnico');

set local role authenticated;

-- ── Quién no puede ───────────────────────────────────────────────────────────

select set_config('request.jwt.claim.sub', 'b3000000-0000-0000-0000-0000000000a2', true);
select is(
  (select reabrir_plantacion('b3000000-0000-0000-0000-000000000002') ->> 'error'),
  'NOT_AUTHORIZED', 'un admin no reabre');

select set_config('request.jwt.claim.sub', 'b3000000-0000-0000-0000-0000000000a3', true);
select is(
  (select reabrir_plantacion('b3000000-0000-0000-0000-000000000002') ->> 'error'),
  'NOT_AUTHORIZED', 'un técnico no reabre');

select set_config('request.jwt.claim.sub', 'b3000000-0000-0000-0000-0000000000a4', true);
select is(
  (select reabrir_plantacion('b3000000-0000-0000-0000-000000000002') ->> 'error'),
  'NOT_AUTHORIZED', 'un superadmin inactivo no reabre');

select set_config('request.jwt.claim.sub', 'b3000000-0000-0000-0000-0000000000a5', true);
select is(
  (select reabrir_plantacion('b3000000-0000-0000-0000-000000000002') ->> 'error'),
  'NOT_AUTHORIZED', 'un superadmin de otra organización no reabre');

select set_config('request.jwt.claim.sub', 'b3000000-0000-0000-0000-0000000000a1', true);
select is(
  (select reabrir_plantacion('b3000000-0000-0000-0000-0000000000ff') ->> 'error'),
  'NOT_AUTHORIZED', 'una plantación inexistente devuelve lo mismo que una ajena');

reset role;
select is(
  (select estado from plantations where id = 'b3000000-0000-0000-0000-000000000002'),
  'finalizada', 'después de los cuatro rechazos sigue finalizada');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b3000000-0000-0000-0000-0000000000a1', true);

-- ── Archivada: primero se desarchiva ─────────────────────────────────────────

select is(
  (select reabrir_plantacion('b3000000-0000-0000-0000-000000000004') ->> 'error'),
  'PLANTACION_ARCHIVADA', 'una archivada no se reabre');

-- ── El superadmin sí ─────────────────────────────────────────────────────────

select is(
  (select reabrir_plantacion('b3000000-0000-0000-0000-000000000002') ->> 'success'),
  'true', 'un superadmin activo reabre');
select is(
  (select estado from plantations where id = 'b3000000-0000-0000-0000-000000000002'),
  'activa', 'la plantación quedó activa');
select is(
  (select estado from groups where id = 'b3000000-0000-0000-0000-000000000006'),
  'finalizada', 'el grupo conserva su estado: reabrir no deshace finalizaciones de grupo');

-- Con la plantación activa, el técnico vuelve a poder escribir: es el punto
-- del issue, que su trabajo atrapado se pueda pushear.
select set_config('request.jwt.claim.sub', 'b3000000-0000-0000-0000-0000000000a3', true);
select lives_ok(
  $$ insert into parcelas (id, plantation_id, nombre, codigo)
     values ('b3000000-0000-0000-0000-000000000007', 'b3000000-0000-0000-0000-000000000002',
             'Sur', 'P-31') $$,
  'reabierta, el técnico vuelve a escribir');

-- ── Idempotencia ─────────────────────────────────────────────────────────────

select set_config('request.jwt.claim.sub', 'b3000000-0000-0000-0000-0000000000a1', true);
select is(
  (select reabrir_plantacion('b3000000-0000-0000-0000-000000000003') ->> 'success'),
  'true', 'reabrir una que ya estaba activa no falla');

select * from finish();
rollback;
