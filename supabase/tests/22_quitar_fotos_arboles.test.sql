-- quitar_fotos_arboles (#498): propaga la foto quitada en el device. Es SECURITY
-- DEFINER, así que valida membresía y plantación escribible por su cuenta.
begin;
select plan(9);

insert into organizations (id, nombre) values
  ('b2200000-0000-0000-0000-000000000001', 'Org Test 22');

insert into auth.users (id, email) values
  ('b2200000-0000-0000-0000-0000000000a1', 'miembro-22@test.local'),
  ('b2200000-0000-0000-0000-0000000000a2', 'outsider-22@test.local');

insert into plantations (id, organizacion_id, lugar, periodo, creado_por, estado) values
  ('b2200000-0000-0000-0000-000000000002', 'b2200000-0000-0000-0000-000000000001',
   'Activa 22', '2026', 'b2200000-0000-0000-0000-0000000000a1', 'activa'),
  ('b2200000-0000-0000-0000-000000000012', 'b2200000-0000-0000-0000-000000000001',
   'Finalizada 22', '2026', 'b2200000-0000-0000-0000-0000000000a1', 'finalizada');

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b2200000-0000-0000-0000-000000000003', 'b2200000-0000-0000-0000-000000000002', 'P22', 'P22'),
  ('b2200000-0000-0000-0000-000000000013', 'b2200000-0000-0000-0000-000000000012', 'P22b', 'P22b');

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b2200000-0000-0000-0000-000000000002', 'b2200000-0000-0000-0000-0000000000a1', 'tecnico'),
  ('b2200000-0000-0000-0000-000000000012', 'b2200000-0000-0000-0000-0000000000a1', 'tecnico');

insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador) values
  ('b2200000-0000-0000-0000-000000000004', 'b2200000-0000-0000-0000-000000000002',
   'b2200000-0000-0000-0000-000000000003', 'G22', 'G22', 'linea',
   'b2200000-0000-0000-0000-0000000000a1'),
  ('b2200000-0000-0000-0000-000000000014', 'b2200000-0000-0000-0000-000000000012',
   'b2200000-0000-0000-0000-000000000013', 'G22b', 'G22b', 'linea',
   'b2200000-0000-0000-0000-0000000000a1');

insert into trees (id, group_id, posicion, sub_id, usuario_registro, foto_url) values
  ('b2200000-0000-0000-0000-000000000f11'::uuid, 'b2200000-0000-0000-0000-000000000004',
   1, 'A1', 'b2200000-0000-0000-0000-0000000000a1', 'plantations/x/trees/f11.jpg'),
  ('b2200000-0000-0000-0000-000000000f12'::uuid, 'b2200000-0000-0000-0000-000000000004',
   2, 'A2', 'b2200000-0000-0000-0000-0000000000a1', 'plantations/x/trees/f12.jpg'),
  ('b2200000-0000-0000-0000-000000000f21'::uuid, 'b2200000-0000-0000-0000-000000000014',
   1, 'B1', 'b2200000-0000-0000-0000-0000000000a1', 'plantations/x/trees/f21.jpg');

-- ── Un no-miembro no quita nada ──────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b2200000-0000-0000-0000-0000000000a2', true);

select is(
  (quitar_fotos_arboles(array['b2200000-0000-0000-0000-000000000f11']::uuid[])->>'quitadas')::int,
  0,
  'un no-miembro no quita la foto de otra plantación'
);

reset role;
select is(
  (select foto_url from trees where id = 'b2200000-0000-0000-0000-000000000f11'::uuid),
  'plantations/x/trees/f11.jpg',
  'la foto sigue ahí después del intento del no-miembro'
);

-- ── Un miembro sí, sin tocar las demás fotos ─────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b2200000-0000-0000-0000-0000000000a1', true);

select is(
  (quitar_fotos_arboles(array['b2200000-0000-0000-0000-000000000f11']::uuid[])->>'quitadas')::int,
  1,
  'un miembro quita la foto de su plantación'
);

reset role;
select is(
  (select foto_url from trees where id = 'b2200000-0000-0000-0000-000000000f11'::uuid),
  null,
  'foto_url queda en null'
);
select is(
  (select foto_url from trees where id = 'b2200000-0000-0000-0000-000000000f12'::uuid),
  'plantations/x/trees/f12.jpg',
  'la foto de otro árbol del grupo no se toca'
);

-- ── Plantación finalizada: se rechaza y vuelve el id ────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b2200000-0000-0000-0000-0000000000a1', true);

select is(
  quitar_fotos_arboles(array['b2200000-0000-0000-0000-000000000f21']::uuid[])->'rechazados',
  '["b2200000-0000-0000-0000-000000000f21"]'::jsonb,
  'en una plantación finalizada el id vuelve como rechazado'
);

reset role;
select is(
  (select foto_url from trees where id = 'b2200000-0000-0000-0000-000000000f21'::uuid),
  'plantations/x/trees/f21.jpg',
  'la foto de la plantación finalizada no se quita'
);

-- ── Reintentar e ids inexistentes son seguros ────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b2200000-0000-0000-0000-0000000000a1', true);

select is(
  quitar_fotos_arboles(array[
    'b2200000-0000-0000-0000-000000000f11',
    'b2200000-0000-0000-0000-0000000000ff'
  ]::uuid[]),
  '{"success": true, "quitadas": 0, "rechazados": []}'::jsonb,
  'reintentar y mandar un id que no existe no falla ni lo rechaza'
);

reset role;
select ok(
  not has_function_privilege('anon', 'quitar_fotos_arboles(uuid[])', 'execute'),
  'anon no puede ejecutarla'
);

select * from finish();
rollback;
