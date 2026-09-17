-- INSERT y UPDATE de fotos en tree-photos exigen plantación escribible (046, #512).
-- Activa: cualquier miembro. Finalizada: solo superadmin. Archivada: nadie.
begin;
select plan(14);

insert into organizations (id, nombre) values
  ('b2400000-0000-0000-0000-000000000001', 'Org Test 24');

insert into auth.users (id, email) values
  ('b2400000-0000-0000-0000-0000000000a1', 'tecnico-24@test.local'),
  ('b2400000-0000-0000-0000-0000000000a2', 'admin-24@test.local'),
  ('b2400000-0000-0000-0000-0000000000a3', 'super-24@test.local');

update profiles set organizacion_id = 'b2400000-0000-0000-0000-000000000001'
  where id::text like 'b2400000-%';
update profiles set rol = 'admin' where id = 'b2400000-0000-0000-0000-0000000000a2';
update profiles set rol = 'superadmin' where id = 'b2400000-0000-0000-0000-0000000000a3';

-- Los admin quedan miembros de las tres por trigger.
insert into plantations (id, organizacion_id, lugar, periodo, creado_por, estado, archivada_en) values
  ('b2400000-0000-0000-0000-000000000010', 'b2400000-0000-0000-0000-000000000001',
   'Activa 24', '2026', 'b2400000-0000-0000-0000-0000000000a2', 'activa', null),
  ('b2400000-0000-0000-0000-000000000020', 'b2400000-0000-0000-0000-000000000001',
   'Finalizada 24', '2026', 'b2400000-0000-0000-0000-0000000000a2', 'finalizada', null),
  ('b2400000-0000-0000-0000-000000000030', 'b2400000-0000-0000-0000-000000000001',
   'Archivada 24', '2026', 'b2400000-0000-0000-0000-0000000000a2', 'activa', now());

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b2400000-0000-0000-0000-000000000010', 'b2400000-0000-0000-0000-0000000000a1', 'tecnico'),
  ('b2400000-0000-0000-0000-000000000020', 'b2400000-0000-0000-0000-0000000000a1', 'tecnico'),
  ('b2400000-0000-0000-0000-000000000030', 'b2400000-0000-0000-0000-0000000000a1', 'tecnico');

insert into storage.buckets (id, name, public) values ('tree-photos', 'tree-photos', false)
  on conflict (id) do nothing;

-- Fotos ya subidas antes de finalizar o archivar, para los UPDATE.
insert into storage.objects (bucket_id, name, metadata) values
  ('tree-photos', 'plantations/b2400000-0000-0000-0000-000000000010/parcelas/x/trees/previa.jpg', '{"v": 0}'),
  ('tree-photos', 'plantations/b2400000-0000-0000-0000-000000000020/parcelas/x/trees/previa.jpg', '{"v": 0}'),
  ('tree-photos', 'plantations/b2400000-0000-0000-0000-000000000030/parcelas/x/trees/previa.jpg', '{"v": 0}');

set local role authenticated;

-- ── INSERT ───────────────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b2400000-0000-0000-0000-0000000000a1', true);
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('tree-photos', 'plantations/b2400000-0000-0000-0000-000000000010/parcelas/x/trees/t.jpg') $$,
  'técnico: sube a una activa');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('tree-photos', 'plantations/b2400000-0000-0000-0000-000000000020/parcelas/x/trees/t.jpg') $$,
  '42501', null, 'técnico: no sube a una finalizada');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('tree-photos', 'plantations/b2400000-0000-0000-0000-000000000030/parcelas/x/trees/t.jpg') $$,
  '42501', null, 'técnico: no sube a una archivada');

select set_config('request.jwt.claim.sub', 'b2400000-0000-0000-0000-0000000000a2', true);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('tree-photos', 'plantations/b2400000-0000-0000-0000-000000000020/parcelas/x/trees/a.jpg') $$,
  '42501', null, 'admin: no sube a una finalizada');

select set_config('request.jwt.claim.sub', 'b2400000-0000-0000-0000-0000000000a3', true);
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('tree-photos', 'plantations/b2400000-0000-0000-0000-000000000020/parcelas/x/trees/s.jpg') $$,
  'superadmin: sube a una finalizada');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('tree-photos', 'plantations/b2400000-0000-0000-0000-000000000030/parcelas/x/trees/s.jpg') $$,
  '42501', null, 'superadmin: no sube a una archivada');

-- ── UPSERT, como sube el móvil ───────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b2400000-0000-0000-0000-0000000000a1', true);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, metadata)
     values ('tree-photos', 'plantations/b2400000-0000-0000-0000-000000000020/parcelas/x/trees/previa.jpg', '{"v": 1}')
     on conflict (bucket_id, name) do update set metadata = excluded.metadata $$,
  '42501', null, 'técnico: no reemplaza por upsert una foto de una finalizada');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, metadata)
     values ('tree-photos', 'plantations/b2400000-0000-0000-0000-000000000010/parcelas/x/trees/previa.jpg', '{"v": 1}')
     on conflict (bucket_id, name) do update set metadata = excluded.metadata $$,
  'técnico: reemplaza por upsert una foto de una activa');

-- ── UPDATE ───────────────────────────────────────────────────────────────────
update storage.objects set metadata = '{"v": 2}'
  where name = 'plantations/b2400000-0000-0000-0000-000000000020/parcelas/x/trees/previa.jpg';
select set_config('request.jwt.claim.sub', 'b2400000-0000-0000-0000-0000000000a3', true);
update storage.objects set metadata = '{"v": 3}'
  where name = 'plantations/b2400000-0000-0000-0000-000000000030/parcelas/x/trees/previa.jpg';

reset role;
select is(
  (select metadata->>'v' from storage.objects
    where name = 'plantations/b2400000-0000-0000-0000-000000000010/parcelas/x/trees/previa.jpg'),
  '1', 'el upsert sobre la activa reemplazó la foto');
select is(
  (select metadata->>'v' from storage.objects
    where name = 'plantations/b2400000-0000-0000-0000-000000000020/parcelas/x/trees/previa.jpg'),
  '0', 'técnico: no actualiza una foto de una finalizada');
select is(
  (select metadata->>'v' from storage.objects
    where name = 'plantations/b2400000-0000-0000-0000-000000000030/parcelas/x/trees/previa.jpg'),
  '0', 'superadmin: no actualiza una foto de una archivada');
set local role authenticated;

select set_config('request.jwt.claim.sub', 'b2400000-0000-0000-0000-0000000000a3', true);
update storage.objects set metadata = '{"v": 4}'
  where name = 'plantations/b2400000-0000-0000-0000-000000000020/parcelas/x/trees/previa.jpg';

reset role;
select is(
  (select metadata->>'v' from storage.objects
    where name = 'plantations/b2400000-0000-0000-0000-000000000020/parcelas/x/trees/previa.jpg'),
  '4', 'superadmin: actualiza una foto de una finalizada');

-- ── Desarchivar la habilita de nuevo ─────────────────────────────────────────
update plantations set archivada_en = null where id = 'b2400000-0000-0000-0000-000000000030';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b2400000-0000-0000-0000-0000000000a1', true);
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('tree-photos', 'plantations/b2400000-0000-0000-0000-000000000030/parcelas/x/trees/d.jpg') $$,
  'técnico: sube a una desarchivada');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('tree-photos', 'plantations/b2400000-0000-0000-0000-0000000000ff/parcelas/x/trees/t.jpg') $$,
  '42501', null, 'técnico: no sube a una plantación inexistente');

select * from finish();
rollback;
