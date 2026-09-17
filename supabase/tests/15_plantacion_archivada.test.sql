-- Plantación archivada (#477): oculta y de solo lectura, también para superadmin.
-- Archivan y desarchivan admin y superadmin activos de la misma organización.
begin;
select plan(44);

insert into organizations (id, nombre) values
  ('b1500000-0000-0000-0000-000000000001', 'Org Test 15'),
  ('b1500000-0000-0000-0000-000000000009', 'Otra Org 15');

insert into auth.users (id, email) values
  ('b1500000-0000-0000-0000-0000000000a1', 'tecnico-15@test.local'),
  ('b1500000-0000-0000-0000-0000000000a2', 'admin-15@test.local'),
  ('b1500000-0000-0000-0000-0000000000a3', 'superadmin-15@test.local'),
  ('b1500000-0000-0000-0000-0000000000a4', 'admin-inactivo-15@test.local'),
  ('b1500000-0000-0000-0000-0000000000a5', 'admin-otra-org-15@test.local');

update profiles set organizacion_id = 'b1500000-0000-0000-0000-000000000001'
  where id = 'b1500000-0000-0000-0000-0000000000a1';
update profiles set rol = 'admin', organizacion_id = 'b1500000-0000-0000-0000-000000000001'
  where id = 'b1500000-0000-0000-0000-0000000000a2';
update profiles set rol = 'superadmin', organizacion_id = 'b1500000-0000-0000-0000-000000000001'
  where id = 'b1500000-0000-0000-0000-0000000000a3';
update profiles set rol = 'admin', activo = false,
  organizacion_id = 'b1500000-0000-0000-0000-000000000001'
  where id = 'b1500000-0000-0000-0000-0000000000a4';
update profiles set rol = 'superadmin', organizacion_id = 'b1500000-0000-0000-0000-000000000009'
  where id = 'b1500000-0000-0000-0000-0000000000a5';

-- P1: activa, para la matriz de roles. P2: finalizada y archivada. P3: activa y
-- archivada, con datos, para las escrituras.
insert into plantations (id, organizacion_id, lugar, periodo, creado_por, estado, archivada_en) values
  ('b1500000-0000-0000-0000-000000000010', 'b1500000-0000-0000-0000-000000000001',
   'Matriz 15', '2026', 'b1500000-0000-0000-0000-0000000000a2', 'activa', null),
  ('b1500000-0000-0000-0000-000000000020', 'b1500000-0000-0000-0000-000000000001',
   'Finalizada 15', '2026', 'b1500000-0000-0000-0000-0000000000a2', 'finalizada', now()),
  ('b1500000-0000-0000-0000-000000000030', 'b1500000-0000-0000-0000-000000000001',
   'Archivada 15', '2026', 'b1500000-0000-0000-0000-0000000000a2', 'activa', now());

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b1500000-0000-0000-0000-000000000021', 'b1500000-0000-0000-0000-000000000020', 'P15f', 'P15f'),
  ('b1500000-0000-0000-0000-000000000031', 'b1500000-0000-0000-0000-000000000030', 'P15', 'P15');

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b1500000-0000-0000-0000-000000000010', 'b1500000-0000-0000-0000-0000000000a1', 'tecnico'),
  ('b1500000-0000-0000-0000-000000000020', 'b1500000-0000-0000-0000-0000000000a1', 'tecnico'),
  ('b1500000-0000-0000-0000-000000000030', 'b1500000-0000-0000-0000-0000000000a1', 'tecnico'),
  ('b1500000-0000-0000-0000-000000000030', 'b1500000-0000-0000-0000-0000000000a3', 'admin')
  on conflict (plantation_id, user_id) do nothing;

insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador) values
  ('b1500000-0000-0000-0000-000000000032', 'b1500000-0000-0000-0000-000000000030',
   'b1500000-0000-0000-0000-000000000031', 'G15', 'G15', 'linea',
   'b1500000-0000-0000-0000-0000000000a1');

insert into trees (id, group_id, posicion, sub_id, usuario_registro) values
  ('b1500000-0000-0000-0000-000000000f33', 'b1500000-0000-0000-0000-000000000032',
   1, 'A1', 'b1500000-0000-0000-0000-0000000000a1');

insert into species (id, codigo, nombre) values
  ('b1500000-0000-0000-0000-000000000040', 'SP15', 'Especie 15');

create temp table payload_15 as
select jsonb_build_object(
  'id', 'b1500000-0000-0000-0000-000000000034',
  'plantation_id', 'b1500000-0000-0000-0000-000000000030',
  'parcela_id', 'b1500000-0000-0000-0000-000000000031',
  'nombre', 'G15b', 'codigo', 'G15b', 'tipo', 'linea', 'estado', 'activa',
  'usuario_creador', 'b1500000-0000-0000-0000-0000000000a1',
  'created_at', now()::text
) as grupo;
grant select on payload_15 to authenticated;

set local role authenticated;

-- ── Matriz de roles: archivar ───────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b1500000-0000-0000-0000-0000000000a1', true);
select is(archivar_plantacion('b1500000-0000-0000-0000-000000000010')->>'error', 'NOT_AUTHORIZED',
  'tecnico no archiva');

select set_config('request.jwt.claim.sub', 'b1500000-0000-0000-0000-0000000000a4', true);
select is(archivar_plantacion('b1500000-0000-0000-0000-000000000010')->>'error', 'NOT_AUTHORIZED',
  'admin inactivo no archiva');

select set_config('request.jwt.claim.sub', 'b1500000-0000-0000-0000-0000000000a5', true);
select is(archivar_plantacion('b1500000-0000-0000-0000-000000000010')->>'error', 'NOT_AUTHORIZED',
  'superadmin de otra organización no archiva');

select is(archivar_plantacion('b1500000-0000-0000-0000-0000000000ff')->>'error', 'NOT_AUTHORIZED',
  'una plantación inexistente responde igual que sin permiso');

reset role;
select is((select archivada_en from plantations where id = 'b1500000-0000-0000-0000-000000000010'),
  null, 'los rechazos no archivaron nada');
set local role authenticated;

select set_config('request.jwt.claim.sub', 'b1500000-0000-0000-0000-0000000000a2', true);
select is((archivar_plantacion('b1500000-0000-0000-0000-000000000010')->>'success')::boolean, true,
  'admin archiva');

reset role;
select is((select archivada_por from plantations where id = 'b1500000-0000-0000-0000-000000000010'),
  'b1500000-0000-0000-0000-0000000000a2'::uuid, 'queda registrado quién la archivó');
set local role authenticated;

select set_config('request.jwt.claim.sub', 'b1500000-0000-0000-0000-0000000000a3', true);
select is((archivar_plantacion('b1500000-0000-0000-0000-000000000010')->>'success')::boolean, true,
  'archivar una archivada es idempotente');

reset role;
select is((select archivada_por from plantations where id = 'b1500000-0000-0000-0000-000000000010'),
  'b1500000-0000-0000-0000-0000000000a2'::uuid, 'el re-archivado conserva al autor original');
set local role authenticated;

-- ── Matriz de roles: desarchivar ────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b1500000-0000-0000-0000-0000000000a1', true);
select is(desarchivar_plantacion('b1500000-0000-0000-0000-000000000010')->>'error', 'NOT_AUTHORIZED',
  'tecnico no desarchiva');

select set_config('request.jwt.claim.sub', 'b1500000-0000-0000-0000-0000000000a4', true);
select is(desarchivar_plantacion('b1500000-0000-0000-0000-000000000010')->>'error', 'NOT_AUTHORIZED',
  'admin inactivo no desarchiva');

select set_config('request.jwt.claim.sub', 'b1500000-0000-0000-0000-0000000000a5', true);
select is(desarchivar_plantacion('b1500000-0000-0000-0000-000000000010')->>'error', 'NOT_AUTHORIZED',
  'superadmin de otra organización no desarchiva');

select set_config('request.jwt.claim.sub', 'b1500000-0000-0000-0000-0000000000a3', true);
select is((desarchivar_plantacion('b1500000-0000-0000-0000-000000000010')->>'success')::boolean, true,
  'superadmin desarchiva');

reset role;
select ok((select archivada_en is null and archivada_por is null from plantations
  where id = 'b1500000-0000-0000-0000-000000000010'), 'desarchivar limpia fecha y autor');
set local role authenticated;

select is((desarchivar_plantacion('b1500000-0000-0000-0000-000000000010')->>'success')::boolean, true,
  'desarchivar una no archivada es idempotente');

select is((archivar_plantacion('b1500000-0000-0000-0000-000000000010')->>'success')::boolean, true,
  'superadmin archiva');

select set_config('request.jwt.claim.sub', 'b1500000-0000-0000-0000-0000000000a2', true);
select is((desarchivar_plantacion('b1500000-0000-0000-0000-000000000010')->>'success')::boolean, true,
  'admin desarchiva');

-- ── Archivar solo por RPC ───────────────────────────────────────────────────
select throws_ok(
  $$update plantations set archivada_en = now() where id = 'b1500000-0000-0000-0000-000000000010'$$,
  '42501', null, 'un UPDATE directo no archiva: salteaba el chequeo de organización');

reset role;
set local role anon;
select throws_ok(
  $$select archivar_plantacion('b1500000-0000-0000-0000-000000000010')$$,
  '42501', null, 'anon no puede ejecutar archivar_plantacion');
reset role;
set local role authenticated;

-- ── Una archivada no es escribible, ni para superadmin ──────────────────────
select set_config('request.jwt.claim.sub', 'b1500000-0000-0000-0000-0000000000a1', true);
select is(plantacion_escribible('b1500000-0000-0000-0000-000000000030'), false,
  'tecnico: archivada no es escribible');

select is((select sync_subgroup(grupo, '[]'::jsonb)->>'error' from payload_15), 'PLANTACION_ARCHIVADA',
  'sync_subgroup rechaza con código propio');

select is(
  (sincronizar_borrados('[{"id": "b1500000-0000-0000-0000-000000000f33", "tipo": "arbol"}]'::jsonb)->>'arboles')::int,
  0, 'sincronizar_borrados no borra el árbol de una archivada');

select is(
  sincronizar_borrados('[{"id": "b1500000-0000-0000-0000-000000000f33", "tipo": "arbol"}]'::jsonb)->'rechazos',
  '[{"id": "b1500000-0000-0000-0000-000000000f33", "error": "PLANTACION_ARCHIVADA"}]'::jsonb,
  'sincronizar_borrados informa el rechazo con código PLANTACION_ARCHIVADA');

select is(
  sincronizar_borrados('[{"id": "b1500000-0000-0000-0000-000000000032", "tipo": "grupo"}]'::jsonb)->'rechazados',
  '["b1500000-0000-0000-0000-000000000032"]'::jsonb,
  'rechazados sigue presente para los APK viejos');

select throws_ok(
  $$insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador)
    values ('b1500000-0000-0000-0000-000000000035', 'b1500000-0000-0000-0000-000000000030',
            'b1500000-0000-0000-0000-000000000031', 'Nuevo', 'NV', 'linea',
            'b1500000-0000-0000-0000-0000000000a1')$$,
  '42501', null, 'tecnico no crea grupos en una archivada');

select throws_ok(
  $$insert into trees (id, group_id, posicion, sub_id, usuario_registro)
    values ('b1500000-0000-0000-0000-000000000f34', 'b1500000-0000-0000-0000-000000000032',
            2, 'A2', 'b1500000-0000-0000-0000-0000000000a1')$$,
  '42501', null, 'tecnico no crea árboles en una archivada');

select set_config('request.jwt.claim.sub', 'b1500000-0000-0000-0000-0000000000a3', true);
select is(plantacion_escribible('b1500000-0000-0000-0000-000000000030'), false,
  'superadmin: archivada tampoco es escribible');

select is((select sync_subgroup(grupo, '[]'::jsonb)->>'error' from payload_15), 'PLANTACION_ARCHIVADA',
  'superadmin: sync_subgroup también rechaza');

select is(
  sincronizar_borrados('[{"id": "b1500000-0000-0000-0000-000000000f33", "tipo": "arbol"}]'::jsonb)->'rechazos'->0->>'error',
  'PLANTACION_ARCHIVADA', 'superadmin: sincronizar_borrados también rechaza');

select throws_ok(
  $$insert into parcelas (id, plantation_id, nombre, codigo)
    values ('b1500000-0000-0000-0000-000000000036', 'b1500000-0000-0000-0000-000000000030', 'Nueva', 'NV')$$,
  '42501', null, 'superadmin no crea parcelas en una archivada');

select throws_ok(
  $$insert into plantation_species (plantation_id, species_id)
    values ('b1500000-0000-0000-0000-000000000030', 'b1500000-0000-0000-0000-000000000040')$$,
  '42501', null, 'superadmin no agrega especies a una archivada');

-- Los UPDATE bloqueados por USING no explotan: quedan en cero filas.
update trees set sub_id = 'X' where id = 'b1500000-0000-0000-0000-000000000f33';
update parcelas set deleted_at = now() where id = 'b1500000-0000-0000-0000-000000000031';
update plantations set lugar = 'Cambiada' where id = 'b1500000-0000-0000-0000-000000000030';

reset role;
select is((select sub_id from trees where id = 'b1500000-0000-0000-0000-000000000f33'), 'A1',
  'superadmin no edita árboles de una archivada');
select is((select deleted_at from parcelas where id = 'b1500000-0000-0000-0000-000000000031'), null,
  'superadmin no tombstonea parcelas de una archivada');
select is((select lugar from plantations where id = 'b1500000-0000-0000-0000-000000000030'), 'Archivada 15',
  'superadmin no edita la plantación archivada');
select is((select count(*)::int from trees where id = 'b1500000-0000-0000-0000-000000000f33'), 1,
  'el árbol sigue vivo');
set local role authenticated;

-- ── Archivada y finalizada: archivada gana; desarchivar no la reabre ────────
select set_config('request.jwt.claim.sub', 'b1500000-0000-0000-0000-0000000000a3', true);
select is(plantacion_escribible('b1500000-0000-0000-0000-000000000020'), false,
  'superadmin tampoco escribe una finalizada archivada');

select set_config('request.jwt.claim.sub', 'b1500000-0000-0000-0000-0000000000a1', true);
select is(
  sync_subgroup(jsonb_build_object(
    'id', 'b1500000-0000-0000-0000-000000000024',
    'plantation_id', 'b1500000-0000-0000-0000-000000000020',
    'parcela_id', 'b1500000-0000-0000-0000-000000000021',
    'nombre', 'G15f', 'codigo', 'G15f', 'tipo', 'linea', 'estado', 'activa',
    'usuario_creador', 'b1500000-0000-0000-0000-0000000000a1',
    'created_at', now()::text), '[]'::jsonb)->>'error',
  'PLANTACION_ARCHIVADA', 'sobre una finalizada archivada, el motivo es ARCHIVADA');

select set_config('request.jwt.claim.sub', 'b1500000-0000-0000-0000-0000000000a2', true);
select is((desarchivar_plantacion('b1500000-0000-0000-0000-000000000020')->>'success')::boolean, true,
  'admin desarchiva la finalizada');

select is((select estado from plantations where id = 'b1500000-0000-0000-0000-000000000020'), 'finalizada',
  'desarchivar no toca el estado');

select set_config('request.jwt.claim.sub', 'b1500000-0000-0000-0000-0000000000a1', true);
select is(plantacion_escribible('b1500000-0000-0000-0000-000000000020'), false,
  'tecnico: sigue siendo inescribible por finalizada');

select set_config('request.jwt.claim.sub', 'b1500000-0000-0000-0000-0000000000a3', true);
select is(plantacion_escribible('b1500000-0000-0000-0000-000000000020'), true,
  'superadmin: vuelve a poder escribir la finalizada');

-- ── Desarchivar restaura la escritura ───────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b1500000-0000-0000-0000-0000000000a2', true);
select is((desarchivar_plantacion('b1500000-0000-0000-0000-000000000030')->>'success')::boolean, true,
  'admin desarchiva la activa');

select set_config('request.jwt.claim.sub', 'b1500000-0000-0000-0000-0000000000a1', true);
select is((select (sync_subgroup(grupo, '[]'::jsonb)->>'success')::boolean from payload_15), true,
  'desarchivada: sync_subgroup vuelve a subir el pendiente');

select lives_ok(
  $$insert into parcelas (id, plantation_id, nombre, codigo)
    values ('b1500000-0000-0000-0000-000000000037', 'b1500000-0000-0000-0000-000000000030', 'Otra', 'OT')$$,
  'desarchivada: tecnico vuelve a crear parcelas');

select * from finish();
rollback;
