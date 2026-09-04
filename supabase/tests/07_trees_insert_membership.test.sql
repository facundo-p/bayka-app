-- trees INSERT: "Users can insert own trees" (mismo gap que groups, sin
-- membresía) se retira en 030; "Plantation members can insert trees" (011)
-- ya exige membresía y queda como única policy de INSERT.
begin;
select plan(3);

insert into organizations (id, nombre) values
  ('e0000000-0000-0000-0000-000000000001', 'Org Test 07');

insert into auth.users (id, email) values
  ('e0000000-0000-0000-0000-0000000000a1', 'miembro-07@test.local'),
  ('e0000000-0000-0000-0000-0000000000a2', 'outsider-07@test.local');

insert into plantations (id, organizacion_id, lugar, periodo, creado_por) values
  ('e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001',
   'Lugar Test 07', '2026', 'e0000000-0000-0000-0000-0000000000a1');

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002',
   'Parcela 07', 'P07');

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000a1', 'tecnico');
-- a2 (outsider) queda deliberadamente sin fila en plantation_users.

insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador) values
  ('e0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000002',
   'e0000000-0000-0000-0000-000000000003', 'G07', 'G07', 'linea',
   'e0000000-0000-0000-0000-0000000000a1');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-0000000000a2', true);

select throws_ok(
  $$ insert into trees (id, group_id, posicion, sub_id, usuario_registro)
     values ('e0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000004',
             1, 'A1', 'e0000000-0000-0000-0000-0000000000a2') $$,
  '42501'::character(5),
  'new row violates row-level security policy for table "trees"',
  'un no-miembro no puede insertar un árbol aunque sea usuario_registro'
);

select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-0000000000a1', true);

select lives_ok(
  $$ insert into trees (id, group_id, posicion, sub_id, usuario_registro)
     values ('e0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000004',
             1, 'A1', 'e0000000-0000-0000-0000-0000000000a1') $$,
  'un miembro de la plantación puede insertar un árbol'
);

reset role;

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trees'
      and policyname = 'Users can insert own trees'
  ),
  'la policy legacy "Users can insert own trees" ya no existe'
);

select * from finish();
rollback;
