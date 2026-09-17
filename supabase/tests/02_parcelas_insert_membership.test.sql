-- parcelas INSERT: ya estaba correcta (012), guarda de regresión — no debe
-- degradar junto con el fix de groups (030, #306).
begin;
select plan(2);

insert into organizations (id, nombre) values
  ('b0000000-0000-0000-0000-000000000001', 'Org Test 02');

insert into auth.users (id, email) values
  ('b0000000-0000-0000-0000-0000000000a1', 'miembro-02@test.local'),
  ('b0000000-0000-0000-0000-0000000000a2', 'outsider-02@test.local');

insert into plantations (id, organizacion_id, lugar, periodo, creado_por) values
  ('b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
   'Lugar Test 02', '2026', 'b0000000-0000-0000-0000-0000000000a1');

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-0000000000a1', 'tecnico');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-0000000000a2', true);

select throws_ok(
  $$ insert into parcelas (id, plantation_id, nombre, codigo)
     values ('b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002',
             'Parcela outsider', 'P-OUT') $$,
  '42501'::character(5),
  'new row violates row-level security policy for table "parcelas"',
  'un no-miembro no puede crear una parcela'
);

select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-0000000000a1', true);

select lives_ok(
  $$ insert into parcelas (id, plantation_id, nombre, codigo)
     values ('b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002',
             'Parcela miembro', 'P-MIEM') $$,
  'un miembro puede crear una parcela'
);

select * from finish();
rollback;
