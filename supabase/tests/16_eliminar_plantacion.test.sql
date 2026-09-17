-- Eliminar plantaciones de verdad (#478): matriz de permisos, cascade completo,
-- registro en plantaciones_eliminadas y estado_remoto_plantaciones.
begin;
select plan(45);

insert into organizations (id, nombre) values
  ('b1600000-0000-0000-0000-000000000001', 'Org Test 16'),
  ('b1600000-0000-0000-0000-000000000009', 'Otra Org 16');

insert into auth.users (id, email) values
  ('b1600000-0000-0000-0000-0000000000a1', 'tecnico-16@test.local'),
  ('b1600000-0000-0000-0000-0000000000a2', 'admin-16@test.local'),
  ('b1600000-0000-0000-0000-0000000000a3', 'superadmin-16@test.local'),
  ('b1600000-0000-0000-0000-0000000000a4', 'admin-inactivo-16@test.local'),
  ('b1600000-0000-0000-0000-0000000000a5', 'superadmin-otra-org-16@test.local');

update profiles set organizacion_id = 'b1600000-0000-0000-0000-000000000001'
  where id = 'b1600000-0000-0000-0000-0000000000a1';
update profiles set rol = 'admin', organizacion_id = 'b1600000-0000-0000-0000-000000000001'
  where id = 'b1600000-0000-0000-0000-0000000000a2';
update profiles set rol = 'superadmin', organizacion_id = 'b1600000-0000-0000-0000-000000000001'
  where id = 'b1600000-0000-0000-0000-0000000000a3';
update profiles set rol = 'admin', activo = false,
  organizacion_id = 'b1600000-0000-0000-0000-000000000001'
  where id = 'b1600000-0000-0000-0000-0000000000a4';
update profiles set rol = 'superadmin', organizacion_id = 'b1600000-0000-0000-0000-000000000009'
  where id = 'b1600000-0000-0000-0000-0000000000a5';

-- P10 y P11: sin datos. P20: con datos, sin archivar. P30: con datos y
-- archivada (la que borra el superadmin). P40: archivada sin datos. P60: sin
-- membresía del técnico. P90: de la otra organización, ya eliminada.
insert into plantations (id, organizacion_id, lugar, periodo, creado_por, archivada_en) values
  ('b1600000-0000-0000-0000-000000000010', 'b1600000-0000-0000-0000-000000000001',
   'Sin datos 16', '2026', 'b1600000-0000-0000-0000-0000000000a2', null),
  ('b1600000-0000-0000-0000-000000000011', 'b1600000-0000-0000-0000-000000000001',
   'Sin datos bis 16', '2026', 'b1600000-0000-0000-0000-0000000000a2', null),
  ('b1600000-0000-0000-0000-000000000020', 'b1600000-0000-0000-0000-000000000001',
   'Con datos 16', '2026', 'b1600000-0000-0000-0000-0000000000a2', null),
  ('b1600000-0000-0000-0000-000000000030', 'b1600000-0000-0000-0000-000000000001',
   'Archivada 16', '2026', 'b1600000-0000-0000-0000-0000000000a2', now()),
  ('b1600000-0000-0000-0000-000000000040', 'b1600000-0000-0000-0000-000000000001',
   'Archivada vacía 16', '2026', 'b1600000-0000-0000-0000-0000000000a2', now()),
  ('b1600000-0000-0000-0000-000000000060', 'b1600000-0000-0000-0000-000000000001',
   'Ajena 16', '2026', 'b1600000-0000-0000-0000-0000000000a2', null);

insert into plantaciones_eliminadas (id, organizacion_id, nombre) values
  ('b1600000-0000-0000-0000-000000000090', 'b1600000-0000-0000-0000-000000000009', 'Eliminada otra org 16');

insert into species (id, codigo, nombre) values
  ('b1600000-0000-0000-0000-000000000050', 'SP16', 'Especie 16');

-- P30 tiene además una parcela borrada (no cuenta) y un grupo que referencia a su
-- parcela: groups.parcela_id es NO ACTION y tiene que convivir con el cascade.
insert into parcelas (id, plantation_id, nombre, codigo, deleted_at) values
  ('b1600000-0000-0000-0000-000000000021', 'b1600000-0000-0000-0000-000000000020', 'P16a', 'P16a', null),
  ('b1600000-0000-0000-0000-000000000031', 'b1600000-0000-0000-0000-000000000030', 'P16b', 'P16b', null),
  ('b1600000-0000-0000-0000-000000000033', 'b1600000-0000-0000-0000-000000000030', 'P16c', 'P16c', now());

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b1600000-0000-0000-0000-000000000020', 'b1600000-0000-0000-0000-0000000000a1', 'tecnico'),
  ('b1600000-0000-0000-0000-000000000030', 'b1600000-0000-0000-0000-0000000000a1', 'tecnico'),
  ('b1600000-0000-0000-0000-000000000040', 'b1600000-0000-0000-0000-0000000000a1', 'tecnico')
  on conflict (plantation_id, user_id) do nothing;

insert into plantation_species (plantation_id, species_id, orden_visual) values
  ('b1600000-0000-0000-0000-000000000030', 'b1600000-0000-0000-0000-000000000050', 1);

insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador) values
  ('b1600000-0000-0000-0000-000000000022', 'b1600000-0000-0000-0000-000000000020',
   'b1600000-0000-0000-0000-000000000021', 'G16a', 'G16a', 'linea',
   'b1600000-0000-0000-0000-0000000000a1'),
  ('b1600000-0000-0000-0000-000000000032', 'b1600000-0000-0000-0000-000000000030',
   'b1600000-0000-0000-0000-000000000031', 'G16b', 'G16b', 'linea',
   'b1600000-0000-0000-0000-0000000000a1');

insert into trees (id, group_id, posicion, sub_id, usuario_registro, foto_url) values
  ('b1600000-0000-0000-0000-000000000f34', 'b1600000-0000-0000-0000-000000000032',
   1, 'A1', 'b1600000-0000-0000-0000-0000000000a1', 'plantations/x/trees/1.jpg'),
  ('b1600000-0000-0000-0000-000000000f35', 'b1600000-0000-0000-0000-000000000032',
   2, 'A2', 'b1600000-0000-0000-0000-0000000000a1', null);

set local role authenticated;

-- ── Previsualizar ───────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b1600000-0000-0000-0000-0000000000a1', true);
select is(previsualizar_eliminacion_plantacion('b1600000-0000-0000-0000-000000000010')->>'error',
  'NOT_AUTHORIZED', 'tecnico no previsualiza');

select set_config('request.jwt.claim.sub', 'b1600000-0000-0000-0000-0000000000a5', true);
select is(previsualizar_eliminacion_plantacion('b1600000-0000-0000-0000-000000000010')->>'error',
  'NOT_AUTHORIZED', 'superadmin de otra organización no previsualiza');

select set_config('request.jwt.claim.sub', 'b1600000-0000-0000-0000-0000000000a2', true);
select is(previsualizar_eliminacion_plantacion('b1600000-0000-0000-0000-000000000010')
  @> '{"success": true, "puede": true, "motivo": null, "tiene_datos": false}', true,
  'admin: una sin datos se puede borrar');
select is(previsualizar_eliminacion_plantacion('b1600000-0000-0000-0000-000000000020')
  @> '{"puede": false, "motivo": "REQUIERE_SUPERADMIN", "tiene_datos": true}', true,
  'admin: una con datos requiere superadmin');

select set_config('request.jwt.claim.sub', 'b1600000-0000-0000-0000-0000000000a3', true);
select is(previsualizar_eliminacion_plantacion('b1600000-0000-0000-0000-000000000020')
  @> '{"puede": false, "motivo": "REQUIERE_ARCHIVAR"}', true,
  'superadmin: una con datos sin archivar requiere archivar');
select is(previsualizar_eliminacion_plantacion('b1600000-0000-0000-0000-000000000030')
  @> '{"puede": true, "motivo": null, "parcelas": 1, "grupos": 1, "arboles": 2, "arboles_con_foto": 1}',
  true, 'superadmin: una archivada con datos se puede borrar, con sus conteos');

-- ── Eliminar: rechazos ──────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b1600000-0000-0000-0000-0000000000a1', true);
select is(eliminar_plantacion('b1600000-0000-0000-0000-000000000010')->>'error', 'NOT_AUTHORIZED',
  'tecnico no elimina');

select is_empty($$ delete from plantations where id = 'b1600000-0000-0000-0000-000000000010' returning 1 $$,
  'tecnico no borra con un DELETE directo');

select set_config('request.jwt.claim.sub', 'b1600000-0000-0000-0000-0000000000a2', true);
select is_empty($$ delete from plantations where id = 'b1600000-0000-0000-0000-000000000010' returning 1 $$,
  'admin tampoco: el borrado es solo por RPC');

select set_config('request.jwt.claim.sub', 'b1600000-0000-0000-0000-0000000000a4', true);
select is(eliminar_plantacion('b1600000-0000-0000-0000-000000000010')->>'error', 'NOT_AUTHORIZED',
  'admin inactivo no elimina');

select set_config('request.jwt.claim.sub', 'b1600000-0000-0000-0000-0000000000a5', true);
select is(eliminar_plantacion('b1600000-0000-0000-0000-000000000010')->>'error', 'NOT_AUTHORIZED',
  'superadmin de otra organización no elimina');
select is(eliminar_plantacion('b1600000-0000-0000-0000-0000000000ff')->>'error', 'NOT_AUTHORIZED',
  'una inexistente responde igual que sin permiso');

select set_config('request.jwt.claim.sub', 'b1600000-0000-0000-0000-0000000000a2', true);
select is(eliminar_plantacion('b1600000-0000-0000-0000-000000000020', 'Con datos 16')->>'error',
  'REQUIERE_SUPERADMIN', 'admin no elimina una con datos');
select is(eliminar_plantacion('b1600000-0000-0000-0000-000000000030', 'Archivada 16')->>'error',
  'REQUIERE_SUPERADMIN', 'admin no elimina una con datos aunque esté archivada');

select set_config('request.jwt.claim.sub', 'b1600000-0000-0000-0000-0000000000a3', true);
select is(eliminar_plantacion('b1600000-0000-0000-0000-000000000020', 'Con datos 16')->>'error',
  'REQUIERE_ARCHIVAR', 'superadmin no elimina una con datos sin archivar');
select is(eliminar_plantacion('b1600000-0000-0000-0000-000000000030', 'Otra cosa')->>'error',
  'NOMBRE_NO_COINCIDE', 'superadmin con nombre incorrecto');
select is(eliminar_plantacion('b1600000-0000-0000-0000-000000000030')->>'error',
  'NOMBRE_NO_COINCIDE', 'superadmin sin nombre');

reset role;
select is((select count(*) from plantations where id in (
    'b1600000-0000-0000-0000-000000000010', 'b1600000-0000-0000-0000-000000000020',
    'b1600000-0000-0000-0000-000000000030'))::int, 3, 'los rechazos no borraron nada');
select is((select count(*) from plantaciones_eliminadas
  where organizacion_id = 'b1600000-0000-0000-0000-000000000001')::int, 0,
  'los rechazos no dejaron registro');
set local role authenticated;

-- ── Eliminar: éxitos ────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b1600000-0000-0000-0000-0000000000a2', true);
select is((eliminar_plantacion('b1600000-0000-0000-0000-000000000010')->>'success')::boolean, true,
  'admin elimina una sin datos sin escribir el nombre');

select set_config('request.jwt.claim.sub', 'b1600000-0000-0000-0000-0000000000a3', true);
select is((eliminar_plantacion('b1600000-0000-0000-0000-000000000011')->>'success')::boolean, true,
  'superadmin elimina una sin datos sin archivar');
select is(eliminar_plantacion('b1600000-0000-0000-0000-000000000030', '  Archivada 16 ')
  @> '{"success": true, "resumen": {"grupos": 1, "arboles": 2}}', true,
  'superadmin elimina una archivada con datos; el nombre se compara sin espacios de más');
select is(eliminar_plantacion('b1600000-0000-0000-0000-000000000030', 'Archivada 16')->>'error',
  'NOT_AUTHORIZED', 'eliminar dos veces: la segunda ya no la encuentra');

reset role;
select is((select count(*) from plantations where id in (
    'b1600000-0000-0000-0000-000000000010', 'b1600000-0000-0000-0000-000000000011',
    'b1600000-0000-0000-0000-000000000030'))::int, 0, 'las plantaciones ya no existen');

-- Cascade completo de P30.
select is((select count(*) from parcelas where plantation_id = 'b1600000-0000-0000-0000-000000000030')::int,
  0, 'cascade: parcelas, incluida la borrada');
select is((select count(*) from groups where plantation_id = 'b1600000-0000-0000-0000-000000000030')::int,
  0, 'cascade: grupos');
select is((select count(*) from trees where group_id = 'b1600000-0000-0000-0000-000000000032')::int,
  0, 'cascade: árboles');
select is((select count(*) from plantation_species where plantation_id = 'b1600000-0000-0000-0000-000000000030')::int,
  0, 'cascade: especies');
select is((select count(*) from plantation_users where plantation_id = 'b1600000-0000-0000-0000-000000000030')::int,
  0, 'cascade: asignaciones');
select is((select count(*) from groups where plantation_id = 'b1600000-0000-0000-0000-000000000020')::int,
  1, 'las demás plantaciones no se tocan');

-- Registro.
select is((select count(*) from plantaciones_eliminadas
  where organizacion_id = 'b1600000-0000-0000-0000-000000000001')::int, 3, 'un registro por eliminada');
select ok((select nombre = 'Archivada 16'
    and eliminada_por = 'b1600000-0000-0000-0000-0000000000a3'
    and eliminada_en is not null
    and not fotos_limpias
    and resumen @> '{"lugar": "Archivada 16", "periodo": "2026", "parcelas": 1, "arboles_con_foto": 1}'
  from plantaciones_eliminadas where id = 'b1600000-0000-0000-0000-000000000030'),
  'el registro guarda nombre, autor, fecha, conteos y fotos pendientes de limpiar');
select is((select eliminada_por from plantaciones_eliminadas where id = 'b1600000-0000-0000-0000-000000000010'),
  'b1600000-0000-0000-0000-0000000000a2'::uuid, 'el registro de la del admin lo tiene como autor');

-- ── Registro: sin acceso directo para los clientes ──────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1600000-0000-0000-0000-0000000000a3', true);
select throws_ok($$ select count(*) from plantaciones_eliminadas $$, '42501', null,
  'ni un superadmin lee el registro directo');
select throws_ok($$ insert into plantaciones_eliminadas (id, organizacion_id, nombre)
    values (gen_random_uuid(), 'b1600000-0000-0000-0000-000000000001', 'x') $$, '42501', null,
  'nadie escribe el registro directo');
select throws_ok($$ select resumen_eliminacion_plantacion('b1600000-0000-0000-0000-000000000020') $$,
  '42501', null, 'los helpers internos no se exponen');

-- ── estado_remoto_plantaciones ──────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b1600000-0000-0000-0000-0000000000a1', true);
create temp table estados_16 as
select * from estado_remoto_plantaciones(array[
  'b1600000-0000-0000-0000-000000000020', 'b1600000-0000-0000-0000-000000000040',
  'b1600000-0000-0000-0000-000000000030', 'b1600000-0000-0000-0000-000000000060',
  'b1600000-0000-0000-0000-000000000090', 'b1600000-0000-0000-0000-0000000000ff'
]::uuid[]);

select is((select count(*) from estados_16)::int, 6, 'una fila por id');
select is((select estado from estados_16 where id = 'b1600000-0000-0000-0000-000000000020'),
  'ok', 'miembro de una activa: ok');
select is((select estado from estados_16 where id = 'b1600000-0000-0000-0000-000000000040'),
  'archivada', 'miembro de una archivada: archivada');
select is((select estado from estados_16 where id = 'b1600000-0000-0000-0000-000000000030'),
  'eliminada', 'eliminada en su organización: eliminada');
select is((select estado from estados_16 where id = 'b1600000-0000-0000-0000-000000000060'),
  'sin_acceso', 'existe pero no es miembro: sin_acceso');
select is((select estado from estados_16 where id = 'b1600000-0000-0000-0000-000000000090'),
  'sin_acceso', 'eliminada de otra organización: sin_acceso');
select is((select estado from estados_16 where id = 'b1600000-0000-0000-0000-0000000000ff'),
  'sin_acceso', 'inexistente: sin_acceso');

-- ── anon ────────────────────────────────────────────────────────────────────
reset role;
set local role anon;
select throws_ok($$ select eliminar_plantacion('b1600000-0000-0000-0000-000000000020') $$,
  '42501', null, 'anon no ejecuta eliminar_plantacion');
select throws_ok($$ select * from estado_remoto_plantaciones(array['b1600000-0000-0000-0000-000000000020']::uuid[]) $$,
  '42501', null, 'anon no ejecuta estado_remoto_plantaciones');

reset role;
select * from finish();
rollback;
