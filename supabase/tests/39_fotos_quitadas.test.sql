-- fotos_quitadas (#516): quitar_fotos_arboles registra el path quitado y la
-- limpieza con service_role devuelve solo lo que ningún árbol volvió a usar.
begin;
select plan(20);

insert into organizations (id, nombre) values
  ('b3900000-0000-0000-0000-000000000001', 'Org Test 39');

insert into auth.users (id, email) values
  ('b3900000-0000-0000-0000-0000000000a1', 'miembro-39@test.local');

select tests.crear_plantacion('b3900000-0000-0000-0000-000000000002', 'b3900000-0000-0000-0000-000000000001',
  'b3900000-0000-0000-0000-0000000000a1', 'Activa 39');

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b3900000-0000-0000-0000-000000000003', 'b3900000-0000-0000-0000-000000000002', 'P39', 'P39');

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b3900000-0000-0000-0000-000000000002', 'b3900000-0000-0000-0000-0000000000a1', 'tecnico');

insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador) values
  ('b3900000-0000-0000-0000-000000000004', 'b3900000-0000-0000-0000-000000000002',
   'b3900000-0000-0000-0000-000000000003', 'G39', 'G39', 'linea',
   'b3900000-0000-0000-0000-0000000000a1');

-- f1: path relativo. f2: URL completa del bucket. f3: se vuelve a asignar.
-- f4: su objeto se reescribe después de quitarla.
insert into trees (id, group_id, posicion, sub_id, usuario_registro, foto_url) values
  ('b3900000-0000-0000-0000-000000000f01', 'b3900000-0000-0000-0000-000000000004',
   1, 'A1', 'b3900000-0000-0000-0000-0000000000a1', 'p39/f01.jpg'),
  ('b3900000-0000-0000-0000-000000000f02', 'b3900000-0000-0000-0000-000000000004',
   2, 'A2', 'b3900000-0000-0000-0000-0000000000a1',
   'https://x.supabase.co/storage/v1/object/sign/tree-photos/p39/f02.jpg?token=abc'),
  ('b3900000-0000-0000-0000-000000000f03', 'b3900000-0000-0000-0000-000000000004',
   3, 'A3', 'b3900000-0000-0000-0000-0000000000a1', 'p39/f03.jpg'),
  ('b3900000-0000-0000-0000-000000000f04', 'b3900000-0000-0000-0000-000000000004',
   4, 'A4', 'b3900000-0000-0000-0000-0000000000a1', 'p39/f04.jpg');

-- Objetos creados antes de quitar las fotos.
insert into storage.objects (bucket_id, name, created_at, updated_at) values
  ('tree-photos', 'p39/f01.jpg', now() - interval '1 day', now() - interval '1 day'),
  ('tree-photos', 'p39/f04.jpg', now() - interval '1 day', now() - interval '1 day');

-- ── Nadie lee ni escribe el registro con JWT de usuario ──────────────────────
select ok(
  not has_table_privilege('authenticated', 'fotos_quitadas', 'select'),
  'authenticated no lee fotos_quitadas'
);
select ok(
  not has_table_privilege('authenticated', 'fotos_quitadas', 'insert'),
  'authenticated no inserta en fotos_quitadas'
);
select ok(
  not has_function_privilege('authenticated', 'fotos_quitadas_por_limpiar(integer)', 'execute'),
  'authenticated no pide las fotos a limpiar'
);
select ok(
  not has_function_privilege('authenticated', 'marcar_fotos_quitadas_borradas(bigint[])', 'execute'),
  'authenticated no marca fotos como borradas'
);

-- ── Quitar registra el path de Storage ───────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b3900000-0000-0000-0000-0000000000a1', true);

select is(
  quitar_fotos_arboles(array[
    'b3900000-0000-0000-0000-000000000f01',
    'b3900000-0000-0000-0000-000000000f02',
    'b3900000-0000-0000-0000-000000000f03',
    'b3900000-0000-0000-0000-000000000f04'
  ]::uuid[]),
  '{"success": true, "quitadas": 4, "rechazados": [], "conservados": {"arboles": []}}'::jsonb,
  'la respuesta no cambia con el registro'
);

reset role;
select is(
  (select count(*)::int from fotos_quitadas where plantation_id = 'b3900000-0000-0000-0000-000000000002'),
  4,
  'una fila por foto quitada'
);
select is(
  (select row(storage_path, plantation_id, quitada_por, limpiada_en, resultado)::text
   from fotos_quitadas where tree_id = 'b3900000-0000-0000-0000-000000000f01'),
  row('p39/f01.jpg', 'b3900000-0000-0000-0000-000000000002'::uuid,
      'b3900000-0000-0000-0000-0000000000a1'::uuid, null::timestamptz, null::text)::text,
  'guarda path, plantación y quién, pendiente de limpiar'
);
select is(
  (select storage_path from fotos_quitadas where tree_id = 'b3900000-0000-0000-0000-000000000f02'),
  'p39/f02.jpg',
  'de una URL completa guarda el path interno, sin el token'
);

-- ── Reintentar no duplica ────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b3900000-0000-0000-0000-0000000000a1', true);
select quitar_fotos_arboles(array['b3900000-0000-0000-0000-000000000f01']::uuid[]);
reset role;
select is(
  (select count(*)::int from fotos_quitadas where tree_id = 'b3900000-0000-0000-0000-000000000f01'),
  1,
  'quitar una foto ya quitada no agrega otra fila'
);

-- ── path_foto_storage ────────────────────────────────────────────────────────
select is(path_foto_storage('file:///data/x.jpg'), null, 'un URI local no tiene path de Storage');
select is(path_foto_storage('content://media/1'), null, 'content:// tampoco');

-- ── Reasignada: el path vuelve a tener foto antes de la limpieza ─────────────
-- now() es fijo dentro de la transacción: se corre la quita al pasado para que
-- la reescritura del objeto quede después.
update fotos_quitadas set quitada_en = quitada_en - interval '1 hour'
  where plantation_id = 'b3900000-0000-0000-0000-000000000002';
update trees set foto_url = 'p39/f03.jpg' where id = 'b3900000-0000-0000-0000-000000000f03';
update storage.objects set updated_at = now()
  where bucket_id = 'tree-photos' and name = 'p39/f04.jpg';

set local role service_role;
select is(
  (select array_agg(storage_path order by storage_path) from fotos_quitadas_por_limpiar(100)),
  array['p39/f01.jpg', 'p39/f02.jpg'],
  'solo devuelve las fotos que nadie volvió a usar'
);
reset role;

select is(
  (select resultado from fotos_quitadas where tree_id = 'b3900000-0000-0000-0000-000000000f03'),
  'reasignada',
  'un path que un árbol vuelve a referenciar queda reasignado, sin borrar'
);
select is(
  (select resultado from fotos_quitadas where tree_id = 'b3900000-0000-0000-0000-000000000f04'),
  'reasignada',
  'un objeto reescrito después de quitarla (foto nueva sin foto_url todavía) no se borra'
);

set local role service_role;
select is(
  (select count(*)::int from fotos_quitadas_por_limpiar(1)),
  1,
  'respeta el límite'
);

-- ── Marcar borradas ──────────────────────────────────────────────────────────
select is(
  marcar_fotos_quitadas_borradas(
    (select array_agg(id) from fotos_quitadas where storage_path in ('p39/f01.jpg', 'p39/f02.jpg'))
  ),
  2,
  'marca las borradas'
);
reset role;

select is(
  (select resultado from fotos_quitadas where tree_id = 'b3900000-0000-0000-0000-000000000f01'),
  'borrada',
  'queda como borrada'
);
select ok(
  (select limpiada_en is not null from fotos_quitadas where tree_id = 'b3900000-0000-0000-0000-000000000f01'),
  'con fecha de limpieza'
);

set local role service_role;
select is(
  (select count(*)::int from fotos_quitadas_por_limpiar(100)),
  0,
  'no queda nada pendiente'
);
select is(
  marcar_fotos_quitadas_borradas(
    (select array_agg(id) from fotos_quitadas where storage_path = 'p39/f01.jpg')
  ),
  0,
  'marcar de nuevo no pisa el resultado'
);
reset role;

select * from finish();
rollback;
