-- Los dos gates que 051 pasó a helpers y el DELETE que sacó (#314).
-- El gate de `generate_tree_ids` ya lo cubre el test 04 entero (técnico, otra
-- organización, admin inactivo, inexistente, archivada); acá va lo que no
-- tenía ninguna red: el cambio de rol del trigger y el borrado de parcelas.
begin;
select plan(9);

insert into organizations (id, nombre) values
  ('b2900000-0000-0000-0000-000000000001', 'Org Test 29');

insert into auth.users (id, email) values
  ('b2900000-0000-0000-0000-0000000000a1', 'admin-29@test.local'),
  ('b2900000-0000-0000-0000-0000000000a2', 'super-29@test.local'),
  ('b2900000-0000-0000-0000-0000000000a3', 'super-inactivo-29@test.local'),
  ('b2900000-0000-0000-0000-0000000000a4', 'tecnico-29@test.local');

update profiles set rol = 'admin', organizacion_id = 'b2900000-0000-0000-0000-000000000001'
  where id = 'b2900000-0000-0000-0000-0000000000a1';
update profiles set rol = 'superadmin', organizacion_id = 'b2900000-0000-0000-0000-000000000001'
  where id = 'b2900000-0000-0000-0000-0000000000a2';
update profiles set rol = 'superadmin', activo = false,
  organizacion_id = 'b2900000-0000-0000-0000-000000000001'
  where id = 'b2900000-0000-0000-0000-0000000000a3';
update profiles set organizacion_id = 'b2900000-0000-0000-0000-000000000001'
  where id = 'b2900000-0000-0000-0000-0000000000a4';

insert into plantations (id, organizacion_id, lugar, periodo, creado_por) values
  ('b2900000-0000-0000-0000-000000000002', 'b2900000-0000-0000-0000-000000000001',
   'Plantación 29', '2026', 'b2900000-0000-0000-0000-0000000000a1');

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b2900000-0000-0000-0000-000000000002', 'b2900000-0000-0000-0000-0000000000a4', 'tecnico');

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b2900000-0000-0000-0000-000000000003', 'b2900000-0000-0000-0000-000000000002',
   'Parcela 29', 'P-29');

set local role authenticated;

-- ── A. Cambio de rol: el trigger ahora pregunta is_superadmin() ─────────────

-- Son dos capas, y se ven distinto. Sobre un perfil ajeno corta la policy
-- `Superadmin can update profiles`: no matchea, no hay error y no cambia nada.
select set_config('request.jwt.claim.sub', 'b2900000-0000-0000-0000-0000000000a1', true);
update profiles set rol = 'admin' where id = 'b2900000-0000-0000-0000-0000000000a4';
select is(
  (select rol from profiles where id = 'b2900000-0000-0000-0000-0000000000a4'),
  'tecnico',
  'un admin no cambia el rol de otro'
);

-- Sobre el propio perfil la policy sí deja pasar (`Users can update own
-- profile`), y ahí el trigger es lo único que frena la auto-promoción.
select throws_ok(
  $$ update profiles set rol = 'superadmin'
     where id = 'b2900000-0000-0000-0000-0000000000a1' $$,
  'P0001',
  'Solo un superadmin puede cambiar roles',
  'un admin no puede promoverse a sí mismo'
);

-- El superadmin inactivo ni siquiera llega al trigger: `Superadmin can update
-- profiles` no matchea la fila, así que el UPDATE no toca nada y no hay error.
select set_config('request.jwt.claim.sub', 'b2900000-0000-0000-0000-0000000000a3', true);
update profiles set rol = 'admin' where id = 'b2900000-0000-0000-0000-0000000000a4';

select set_config('request.jwt.claim.sub', 'b2900000-0000-0000-0000-0000000000a2', true);
select is(
  (select rol from profiles where id = 'b2900000-0000-0000-0000-0000000000a4'),
  'tecnico',
  'un superadmin inactivo no cambia ningún rol'
);

select lives_ok(
  $$ update profiles set rol = 'admin'
     where id = 'b2900000-0000-0000-0000-0000000000a4' $$,
  'un superadmin activo puede cambiar el rol de otro'
);
select is(
  (select rol from profiles where id = 'b2900000-0000-0000-0000-0000000000a4'),
  'admin',
  'el rol quedó cambiado'
);

select throws_ok(
  $$ update profiles set rol = 'admin'
     where id = 'b2900000-0000-0000-0000-0000000000a2' $$,
  'P0001',
  'Un superadmin no puede degradarse a sí mismo',
  'un superadmin no puede bajarse el rol'
);

-- ── B. parcelas: el tombstone sigue, el borrado físico ya no ────────────────

select set_config('request.jwt.claim.sub', 'b2900000-0000-0000-0000-0000000000a4', true);

-- Sin policy de DELETE no hay excepción: el delete no matchea ninguna fila.
delete from parcelas where id = 'b2900000-0000-0000-0000-000000000003';
select is(
  (select count(*)::int from parcelas where id = 'b2900000-0000-0000-0000-000000000003'),
  1,
  'un miembro ya no puede borrar físicamente una parcela'
);

select lives_ok(
  $$ update parcelas set deleted_at = now()
     where id = 'b2900000-0000-0000-0000-000000000003' $$,
  'el tombstone de parcela sigue siendo un UPDATE permitido'
);
select isnt(
  (select deleted_at from parcelas where id = 'b2900000-0000-0000-0000-000000000003'),
  null,
  'la parcela quedó marcada como borrada'
);

select * from finish();
rollback;
