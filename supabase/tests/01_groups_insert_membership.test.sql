-- groups INSERT: la policy "Users can insert own subgroups" (030, #306) exige
-- creador + membresía en plantation_users, no solo creador.
begin;
select plan(3);

insert into organizations (id, nombre) values
  ('a0000000-0000-0000-0000-000000000001', 'Org Test 01');

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-0000000000a1', 'miembro-01@test.local'),
  ('a0000000-0000-0000-0000-0000000000a2', 'outsider-01@test.local');
-- trg_handle_new_user ya creó los profiles (rol tecnico por defecto).

insert into plantations (id, organizacion_id, lugar, periodo, creado_por) values
  ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'Lugar Test 01', '2026', 'a0000000-0000-0000-0000-0000000000a1');

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002',
   'Parcela 01', 'P01');

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-0000000000a1', 'tecnico');
-- a2 (outsider) queda deliberadamente sin fila en plantation_users.

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000a2', true);

select throws_ok(
  $$ insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador)
     values ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002',
             'a0000000-0000-0000-0000-000000000003', 'G-outsider', 'G-OUT', 'linea',
             'a0000000-0000-0000-0000-0000000000a2') $$,
  '42501'::character(5),
  'new row violates row-level security policy for table "groups"',
  'un no-miembro no puede crear un grupo aunque sea el usuario_creador declarado'
);

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000a1', true);

select lives_ok(
  $$ insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador)
     values ('a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002',
             'a0000000-0000-0000-0000-000000000003', 'G-miembro', 'G-MIEM', 'linea',
             'a0000000-0000-0000-0000-0000000000a1') $$,
  'un miembro puede crear un grupo declarándose usuario_creador'
);

select throws_ok(
  $$ insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador)
     values ('a0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002',
             'a0000000-0000-0000-0000-000000000003', 'G-impersonado', 'G-IMP', 'linea',
             'a0000000-0000-0000-0000-0000000000a2') $$,
  '42501'::character(5),
  'new row violates row-level security policy for table "groups"',
  'un miembro no puede crear un grupo declarando usuario_creador de otro usuario'
);

select * from finish();
rollback;
