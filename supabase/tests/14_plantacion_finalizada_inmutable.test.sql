-- Plantación finalizada = inmutable (#469). Hasta 037 la regla vivía sólo en la UI
-- del móvil: las policies y los RPC no sabían qué significa 'finalizada'.
--
-- La excepción es de ROL: un superadmin sí escribe sobre una finalizada (#470).
begin;
select plan(15);

insert into organizations (id, nombre) values
  ('a1000000-0000-0000-0000-000000000001', 'Org Test 14');

insert into auth.users (id, email) values
  ('a1000000-0000-0000-0000-0000000000a1', 'tecnico-14@test.local'),
  ('a1000000-0000-0000-0000-0000000000a2', 'admin-14@test.local'),
  ('a1000000-0000-0000-0000-0000000000a3', 'superadmin-14@test.local'),
  ('a1000000-0000-0000-0000-0000000000a4', 'super-inactivo-14@test.local');

update profiles set rol = 'admin', organizacion_id = 'a1000000-0000-0000-0000-000000000001'
  where id = 'a1000000-0000-0000-0000-0000000000a2';
update profiles set rol = 'superadmin', organizacion_id = 'a1000000-0000-0000-0000-000000000001'
  where id = 'a1000000-0000-0000-0000-0000000000a3';
update profiles set rol = 'superadmin', activo = false,
  organizacion_id = 'a1000000-0000-0000-0000-000000000001'
  where id = 'a1000000-0000-0000-0000-0000000000a4';

-- Una finalizada y una activa, para fijar que lo de abajo no rompe el caso normal.
insert into plantations (id, organizacion_id, lugar, periodo, creado_por, estado) values
  ('a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001',
   'Finalizada 14', '2026', 'a1000000-0000-0000-0000-0000000000a2', 'finalizada'),
  ('a1000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000001',
   'Activa 14', '2026', 'a1000000-0000-0000-0000-0000000000a2', 'activa');

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('a1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002', 'P14', 'P14'),
  ('a1000000-0000-0000-0000-000000000013', 'a1000000-0000-0000-0000-000000000012', 'P14b', 'P14b');

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-0000000000a1', 'tecnico'),
  ('a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-0000000000a3', 'tecnico'),
  ('a1000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-0000000000a1', 'tecnico');

insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador) values
  ('a1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000002',
   'a1000000-0000-0000-0000-000000000003', 'G14', 'G14', 'linea',
   'a1000000-0000-0000-0000-0000000000a1');

insert into trees (id, group_id, posicion, sub_id, usuario_registro) values
  ('a1000000-0000-0000-0000-000000000f11'::uuid, 'a1000000-0000-0000-0000-000000000004',
   1, 'A1', 'a1000000-0000-0000-0000-0000000000a1');

-- ── Los helpers ─────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-0000000000a1', true);

select is(plantacion_escribible('a1000000-0000-0000-0000-000000000002'), false,
  'tecnico: una plantación finalizada no es escribible');
select is(plantacion_escribible('a1000000-0000-0000-0000-000000000012'), true,
  'tecnico: una plantación activa sí es escribible');
select is(plantacion_escribible('a1000000-0000-0000-0000-0000000000ff'), false,
  'una plantación inexistente no es escribible');

select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-0000000000a3', true);
select is(plantacion_escribible('a1000000-0000-0000-0000-000000000002'), true,
  'superadmin: sí puede escribir sobre una finalizada');

select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-0000000000a4', true);
select is(plantacion_escribible('a1000000-0000-0000-0000-000000000002'), false,
  'un superadmin inactivo no puede');

select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-0000000000a2', true);
select is(plantacion_escribible('a1000000-0000-0000-0000-000000000002'), false,
  'admin todavía NO puede: el permiso es de superadmin hasta que se decida lo contrario');

-- ── sincronizar_borrados no borra, y lo informa ─────────────────────────────
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-0000000000a1', true);

select is(
  (sincronizar_borrados('[{"id": "a1000000-0000-0000-0000-000000000f11", "tipo": "arbol"}]'::jsonb)->>'arboles')::int,
  0, 'sincronizar_borrados no borra el árbol de una plantación finalizada');

select is(
  sincronizar_borrados('[{"id": "a1000000-0000-0000-0000-000000000f11", "tipo": "arbol"}]'::jsonb)->'rechazados',
  '["a1000000-0000-0000-0000-000000000f11"]'::jsonb,
  'devuelve el id rechazado para que el cliente lo deje pendiente');

-- Un id que ya no está en el server no es un rechazo: ése el cliente SÍ lo limpia.
select is(
  sincronizar_borrados('[{"id": "a1000000-0000-0000-0000-0000000000ee", "tipo": "arbol"}]'::jsonb)->'rechazados',
  '[]'::jsonb,
  'un id inexistente no se informa como rechazado');

select is(
  (select count(*)::int from trees where id = 'a1000000-0000-0000-0000-000000000f11'),
  1, 'el árbol sigue vivo');

-- ── sync_subgroup rechaza con un código propio ──────────────────────────────
select is(
  sync_subgroup(
    jsonb_build_object(
      'id', 'a1000000-0000-0000-0000-000000000004',
      'plantation_id', 'a1000000-0000-0000-0000-000000000002',
      'parcela_id', 'a1000000-0000-0000-0000-000000000003',
      'nombre', 'G14', 'codigo', 'G14', 'tipo', 'linea', 'estado', 'activa',
      'usuario_creador', 'a1000000-0000-0000-0000-0000000000a1',
      'created_at', now()::text
    ), '[]'::jsonb)->>'error',
  'PLANTACION_FINALIZADA',
  'sync_subgroup rechaza con código propio, distinto de PERMISSION');

-- ── Las policies ────────────────────────────────────────────────────────────
select throws_ok(
  $$insert into parcelas (id, plantation_id, nombre, codigo)
    values ('a1000000-0000-0000-0000-000000000023', 'a1000000-0000-0000-0000-000000000002', 'Nueva', 'NV')$$,
  '42501', null, 'no se crean parcelas en una plantación finalizada');

-- El "Eliminar parcela" del móvil es un tombstone, o sea un UPDATE de deleted_at.
select is(
  (with intento as (
     update parcelas set deleted_at = now()
     where id = 'a1000000-0000-0000-0000-000000000003' returning 1)
   select count(*)::int from intento),
  0, 'no se tombstonea una parcela de una plantación finalizada');

select lives_ok(
  $$insert into parcelas (id, plantation_id, nombre, codigo)
    values ('a1000000-0000-0000-0000-000000000033', 'a1000000-0000-0000-0000-000000000012', 'OK', 'OK')$$,
  'la plantación activa sigue aceptando parcelas nuevas');

-- ── generate_tree_ids sigue andando: SECURITY DEFINER, no pasa por RLS ──────
-- Es la única operación legítima posterior a finalizar (#232), y las policies de
-- arriba no pueden romperla.
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-0000000000a2', true);
select is(
  (generate_tree_ids('a1000000-0000-0000-0000-000000000002', 42)->>'success')::boolean,
  true, 'generate_tree_ids sigue escribiendo trees sobre una plantación finalizada');

select * from finish();
rollback;
