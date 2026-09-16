-- sincronizar_borrados (#467): propaga al server los borrados hechos en el device.
-- Existe porque NO hay policy de DELETE sobre trees ni sobre groups — un delete por
-- PostgREST sería un no-op silencioso— así que va por SECURITY DEFINER, y por eso
-- mismo tiene que validar la membresía por su cuenta.
begin;
select plan(6);

insert into organizations (id, nombre) values
  ('f0000000-0000-0000-0000-000000000001', 'Org Test 13');

insert into auth.users (id, email) values
  ('f0000000-0000-0000-0000-0000000000a1', 'miembro-13@test.local'),
  ('f0000000-0000-0000-0000-0000000000a2', 'outsider-13@test.local');

insert into plantations (id, organizacion_id, lugar, periodo, creado_por) values
  ('f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001',
   'Lugar Test 13', '2026', 'f0000000-0000-0000-0000-0000000000a1');

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('f0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000002',
   'Parcela 13', 'P13');

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-0000000000a1', 'tecnico');
-- a2 (outsider) queda deliberadamente sin fila en plantation_users.

insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador) values
  ('f0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000002',
   'f0000000-0000-0000-0000-000000000003', 'G13', 'G13', 'linea',
   'f0000000-0000-0000-0000-0000000000a1'),
  ('f0000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000002',
   'f0000000-0000-0000-0000-000000000003', 'G13b', 'G13b', 'linea',
   'f0000000-0000-0000-0000-0000000000a1');

insert into trees (id, group_id, posicion, sub_id, usuario_registro) values
  ('f0000000-0000-0000-0000-000000000f11'::uuid, 'f0000000-0000-0000-0000-000000000004',
   1, 'A1', 'f0000000-0000-0000-0000-0000000000a1'),
  ('f0000000-0000-0000-0000-000000000f12'::uuid, 'f0000000-0000-0000-0000-000000000005',
   1, 'B1', 'f0000000-0000-0000-0000-0000000000a1');

-- ── Un no-miembro no borra nada ──────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-0000000000a2', true);

select is(
  (sincronizar_borrados('[{"id":"f0000000-0000-0000-0000-000000000f11","tipo":"arbol"}]'::jsonb)->>'arboles')::int,
  0,
  'un no-miembro no borra el árbol de otra plantación'
);

reset role;
select ok(
  exists (select 1 from trees where id = 'f0000000-0000-0000-0000-000000000f11'::uuid),
  'el árbol sigue ahí después del intento del no-miembro'
);

-- ── Un miembro sí ────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-0000000000a1', true);

select is(
  (sincronizar_borrados('[{"id":"f0000000-0000-0000-0000-000000000f11","tipo":"arbol"}]'::jsonb)->>'arboles')::int,
  1,
  'un miembro borra el árbol de su plantación'
);

-- ── Borrar el grupo se lleva sus árboles por cascada ─────────────────────────
select is(
  (sincronizar_borrados('[{"id":"f0000000-0000-0000-0000-000000000005","tipo":"grupo"}]'::jsonb)->>'grupos')::int,
  1,
  'un miembro borra su grupo'
);

-- ── Reintentar es seguro: borrar lo que ya no está es un no-op ───────────────
select is(
  (sincronizar_borrados('[{"id":"f0000000-0000-0000-0000-000000000f11","tipo":"arbol"}]'::jsonb)->>'success')::boolean,
  true,
  'reintentar un borrado ya aplicado no falla (el push reintenta hasta confirmar)'
);

reset role;
select ok(
  not exists (select 1 from trees where id = 'f0000000-0000-0000-0000-000000000f12'::uuid),
  'los árboles del grupo borrado se fueron por cascada'
);

select * from finish();
rollback;
