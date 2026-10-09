-- Fotos huérfanas (077, #806): archivos de árbol en Storage que ningún
-- `foto_url` referencia y sin quitada pendiente se borran pasados 30 días.
begin;
select plan(15);

insert into organizations (id, nombre) values
  ('c6000000-0000-0000-0000-000000000001', 'Org Test 60');

insert into auth.users (id, email) values
  ('c6000000-0000-0000-0000-0000000000a1', 'miembro-60@test.local');

select tests.crear_plantacion('c6000000-0000-0000-0000-000000000002', 'c6000000-0000-0000-0000-000000000001',
  'c6000000-0000-0000-0000-0000000000a1', 'Activa 60');

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('c6000000-0000-0000-0000-000000000003', 'c6000000-0000-0000-0000-000000000002', 'P60', 'P60');

insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador) values
  ('c6000000-0000-0000-0000-000000000004', 'c6000000-0000-0000-0000-000000000002',
   'c6000000-0000-0000-0000-000000000003', 'G60', 'G60', 'linea',
   'c6000000-0000-0000-0000-0000000000a1');

-- f01 apunta con path relativo; f02 con la URL completa del bucket.
insert into trees (id, group_id, posicion, sub_id, usuario_registro, foto_url) values
  ('c6000000-0000-0000-0000-000000000f01', 'c6000000-0000-0000-0000-000000000004',
   1, 'A1', 'c6000000-0000-0000-0000-0000000000a1',
   'p60/c6000000-0000-0000-0000-000000000f01-v1.jpg'),
  ('c6000000-0000-0000-0000-000000000f02', 'c6000000-0000-0000-0000-000000000004',
   2, 'A2', 'c6000000-0000-0000-0000-0000000000a1',
   'https://x.supabase.co/storage/v1/object/sign/tree-photos/p60/c6000000-0000-0000-0000-000000000f02-v1.jpg?token=abc');

insert into storage.buckets (id, name) values ('otro-60', 'otro-60');

insert into storage.objects (bucket_id, name, created_at, updated_at) values
  ('tree-photos', 'p60/c6000000-0000-0000-0000-000000000f01-v1.jpg', now() - interval '40 days', now() - interval '40 days'),
  ('tree-photos', 'p60/c6000000-0000-0000-0000-000000000f02-v1.jpg', now() - interval '40 days', now() - interval '40 days'),
  ('tree-photos', 'p60/c6000000-0000-0000-0000-000000000f01-v0.jpg', now() - interval '40 days', now() - interval '40 days'),
  ('tree-photos', 'p60/c6000000-0000-0000-0000-000000000f03.jpg',    now() - interval '31 days', now() - interval '31 days'),
  ('tree-photos', 'p60/c6000000-0000-0000-0000-000000000f01-v2.jpg', now() - interval '29 days', now() - interval '29 days'),
  ('tree-photos', 'p60/c6000000-0000-0000-0000-000000000f01-v3.jpg', now() - interval '40 days', now() - interval '1 day'),
  ('tree-photos', 'p60/c6000000-0000-0000-0000-000000000f01-v4.jpg', now() - interval '40 days', now() - interval '40 days'),
  ('tree-photos', 'p60/c6000000-0000-0000-0000-000000000f01-v5.jpg', now() - interval '40 days', now() - interval '40 days'),
  ('tree-photos', 'p60/c6000000-0000-0000-0000-000000000f01-v6.jpg', null, null),
  ('tree-photos', 'p60/notas.jpg', now() - interval '40 days', now() - interval '40 days'),
  ('otro-60', 'p60/c6000000-0000-0000-0000-000000000f01-v7.jpg', now() - interval '40 days', now() - interval '40 days');

-- v4 tiene una quitada pendiente; la de v5 ya se cerró.
insert into fotos_quitadas (storage_path, tree_id, plantation_id) values
  ('p60/c6000000-0000-0000-0000-000000000f01-v4.jpg', 'c6000000-0000-0000-0000-000000000f01',
   'c6000000-0000-0000-0000-000000000002');
insert into fotos_quitadas (storage_path, tree_id, plantation_id, limpiada_en, resultado) values
  ('p60/c6000000-0000-0000-0000-000000000f01-v5.jpg', 'c6000000-0000-0000-0000-000000000f01',
   'c6000000-0000-0000-0000-000000000002', now() - interval '35 days', 'reasignada');

-- ── Permisos ─────────────────────────────────────────────────────────────────
select ok(
  not has_function_privilege('authenticated', 'fotos_huerfanas_por_limpiar(integer)', 'execute'),
  'authenticated no pide las fotos huérfanas'
);
select ok(
  not has_function_privilege('anon', 'fotos_huerfanas_por_limpiar(integer)', 'execute'),
  'anon tampoco'
);

select is(fotos_huerfanas_antiguedad_minima(), interval '30 days', 'el plazo de gracia es de 30 días');

-- ── Qué devuelve ─────────────────────────────────────────────────────────────
create temp table huerfanas_60 as
  select storage_path from fotos_huerfanas_por_limpiar(1000) where storage_path like 'p60/%';

select is(
  (select array_agg(storage_path order by storage_path) from huerfanas_60),
  array[
    'p60/c6000000-0000-0000-0000-000000000f01-v0.jpg',
    'p60/c6000000-0000-0000-0000-000000000f01-v5.jpg',
    'p60/c6000000-0000-0000-0000-000000000f03.jpg'
  ],
  'devuelve solo los archivos de árbol viejos que nadie usa'
);

select ok(exists (select 1 from huerfanas_60 where storage_path = 'p60/c6000000-0000-0000-0000-000000000f01-v0.jpg'),
  'una versión vieja sin árbol se borra');
select ok(exists (select 1 from huerfanas_60 where storage_path = 'p60/c6000000-0000-0000-0000-000000000f03.jpg'),
  'un path sin versión de un árbol que no existe se borra');
select ok(not exists (select 1 from huerfanas_60 where storage_path = 'p60/c6000000-0000-0000-0000-000000000f01-v1.jpg'),
  'el foto_url de un árbol nunca se borra');
select ok(not exists (select 1 from huerfanas_60 where storage_path = 'p60/c6000000-0000-0000-0000-000000000f02-v1.jpg'),
  'tampoco si el foto_url es la URL completa');
select ok(not exists (select 1 from huerfanas_60 where storage_path = 'p60/c6000000-0000-0000-0000-000000000f01-v2.jpg'),
  'uno de menos de 30 días no se borra');
select ok(not exists (select 1 from huerfanas_60 where storage_path = 'p60/c6000000-0000-0000-0000-000000000f01-v3.jpg'),
  'uno reescrito hace poco no se borra aunque se haya creado antes');
select ok(not exists (select 1 from huerfanas_60 where storage_path = 'p60/c6000000-0000-0000-0000-000000000f01-v4.jpg'),
  'uno con quitada pendiente lo deja para fotos_quitadas_por_limpiar');
select ok(not exists (select 1 from huerfanas_60 where storage_path = 'p60/c6000000-0000-0000-0000-000000000f01-v6.jpg'),
  'uno sin fecha no se borra');
select ok(not exists (select 1 from huerfanas_60 where storage_path = 'p60/notas.jpg'),
  'un archivo sin nombre de foto de árbol no se toca');

-- El de `otro-60` tiene nombre de foto de árbol y es viejo, pero no es de tree-photos.
set local role service_role;
select ok(
  not exists (select 1 from fotos_huerfanas_por_limpiar(1000) where storage_path like '%-v7.jpg'),
  'no mira otros buckets'
);
select is(
  (select count(*)::int from fotos_huerfanas_por_limpiar(1)),
  1,
  'respeta el límite'
);
reset role;

select * from finish();
rollback;
