-- DELETE de fotos en tree-photos (041, #481): además de admin, exige membresía
-- en la plantación del path. Antes bastaba con ser admin de cualquier organización.
begin;
select plan(13);

-- org1 usa el UUID que handle_new_user asigna por default a todo auth.users nuevo.
insert into organizations (id, nombre) values
  ('00000000-0000-0000-0000-000000000001', 'Org1 Test 18'),
  ('18000000-0000-0000-0000-000000000001', 'Org2 Test 18');

insert into auth.users (id, email) values
  ('18000000-0000-0000-0000-0000000000a1', 'a1-18@test.local'),
  ('18000000-0000-0000-0000-0000000000a2', 'a2-18@test.local'),
  ('18000000-0000-0000-0000-0000000000a3', 'a3-18@test.local'),
  ('18000000-0000-0000-0000-0000000000b1', 't1-18@test.local');

update profiles set organizacion_id = '18000000-0000-0000-0000-000000000001'
  where id = '18000000-0000-0000-0000-0000000000a2';
update profiles set rol = 'admin' where id in (
  '18000000-0000-0000-0000-0000000000a1',
  '18000000-0000-0000-0000-0000000000a2',
  '18000000-0000-0000-0000-0000000000a3');

-- Las altas disparan trg_add_admin_memberships: A1 y A3 quedan miembros de P1, A2 de P2.
insert into plantations (id, organizacion_id, lugar, periodo, creado_por) values
  ('18000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
   'P1 org1', '2026', '18000000-0000-0000-0000-0000000000a1'),
  ('18000000-0000-0000-0000-000000000020', '18000000-0000-0000-0000-000000000001',
   'P2 org2', '2026', '18000000-0000-0000-0000-0000000000a2');

-- A3: admin de la misma organización pero sin membresía en P1.
delete from plantation_users
  where plantation_id = '18000000-0000-0000-0000-000000000010'
    and user_id = '18000000-0000-0000-0000-0000000000a3';

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('18000000-0000-0000-0000-000000000010', '18000000-0000-0000-0000-0000000000b1', 'tecnico');

select is(
  (select count(*)::int from plantation_users
    where plantation_id = '18000000-0000-0000-0000-000000000010'
      and user_id in ('18000000-0000-0000-0000-0000000000a1', '18000000-0000-0000-0000-0000000000b1')),
  2, 'fixture: A1 (por trigger) y T1 son miembros de P1'
);

-- storage.protect_delete() bloquea todo DELETE directo por SQL salvo con esta GUC.
set local storage.allow_delete_query = 'true';

insert into storage.buckets (id, name, public) values ('tree-photos', 'tree-photos', false)
  on conflict (id) do nothing;
insert into storage.objects (bucket_id, name) values
  ('tree-photos', 'plantations/18000000-0000-0000-0000-000000000010/parcelas/x/trees/p1.jpg'),
  ('tree-photos', 'plantations/18000000-0000-0000-0000-000000000020/parcelas/x/trees/p2.jpg'),
  ('tree-photos', 'plantations/not-a-uuid/parcelas/x/trees/y.jpg');

-- La policy de SELECT ya oculta las fotos a los no miembros, y un DELETE solo alcanza
-- filas visibles: sin esta policy extra el test pasaría aun sin la 041.
create policy "test 18 lectura abierta" on storage.objects for select to authenticated
  using (bucket_id = 'tree-photos');

select ok(
  (select qual like '%is_plantation_member%' from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Admins can delete tree photos'),
  'la policy de DELETE exige membresía en la plantación'
);

set local role authenticated;

-- ── Técnico miembro: no borra ───────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '18000000-0000-0000-0000-0000000000b1', true);
select lives_ok(
  $$ delete from storage.objects where bucket_id = 'tree-photos'
       and name like 'plantations/18000000-0000-0000-0000-000000000010/%' $$,
  'el delete de T1 (técnico) no lanza excepción: RLS filtra'
);
reset role;
select is(
  (select count(*)::int from storage.objects where name like 'plantations/18000000-0000-0000-0000-000000000010/%'),
  1, 'T1 (técnico miembro) no borró la foto de P1'
);

-- ── Admin de otra organización: no borra ────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '18000000-0000-0000-0000-0000000000a2', true);
select lives_ok(
  $$ delete from storage.objects where bucket_id = 'tree-photos'
       and name like 'plantations/18000000-0000-0000-0000-000000000010/%' $$,
  'el delete de A2 (admin org2) sobre P1 no lanza excepción'
);
reset role;
select is(
  (select count(*)::int from storage.objects where name like 'plantations/18000000-0000-0000-0000-000000000010/%'),
  1, 'A2 (admin de otra organización) no borró la foto de P1'
);

-- ── Admin de la misma organización sin membresía: no borra ──────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '18000000-0000-0000-0000-0000000000a3', true);
select lives_ok(
  $$ delete from storage.objects where bucket_id = 'tree-photos'
       and name like 'plantations/18000000-0000-0000-0000-000000000010/%' $$,
  'el delete de A3 (admin no miembro) sobre P1 no lanza excepción'
);
reset role;
select is(
  (select count(*)::int from storage.objects where name like 'plantations/18000000-0000-0000-0000-000000000010/%'),
  1, 'A3 (admin no miembro de P1) no borró la foto de P1'
);

-- ── Admin miembro: borra ────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '18000000-0000-0000-0000-0000000000a1', true);
select lives_ok(
  $$ delete from storage.objects where bucket_id = 'tree-photos'
       and name like 'plantations/18000000-0000-0000-0000-000000000010/%' $$,
  'A1 (admin miembro) borra la foto de P1'
);
select lives_ok(
  $$ delete from storage.objects where bucket_id = 'tree-photos'
       and name = 'plantations/not-a-uuid/parcelas/x/trees/y.jpg' $$,
  'el delete de A1 sobre un path malformado no lanza excepción'
);
reset role;
select is(
  (select count(*)::int from storage.objects where name like 'plantations/18000000-0000-0000-0000-000000000010/%'),
  0, 'la foto de P1 quedó borrada por A1'
);
select is(
  (select count(*)::int from storage.objects where name = 'plantations/not-a-uuid/parcelas/x/trees/y.jpg'),
  1, 'el path malformado no se borra (fail-closed)'
);

-- ── Admin de org2 en su propia plantación: borra ────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '18000000-0000-0000-0000-0000000000a2', true);
delete from storage.objects where bucket_id = 'tree-photos'
  and name like 'plantations/18000000-0000-0000-0000-000000000020/%';
reset role;
select is(
  (select count(*)::int from storage.objects where name like 'plantations/18000000-0000-0000-0000-000000000020/%'),
  0, 'A2 (admin miembro de P2) borra la foto de P2'
);

select * from finish();
rollback;
