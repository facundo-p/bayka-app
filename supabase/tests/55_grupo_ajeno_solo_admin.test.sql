-- En un grupo que ya existe y creó otro usuario, solo escriben admin y superadmin
-- (072, #768): sync_subgroup recorre la tabla `grupoAjeno` de
-- contracts/permisos-edicion.json; las policies de trees y Storage y
-- quitar_fotos_arboles, con un técnico ajeno, el creador y los dos admins.
-- sincronizar_borrados todavía no aplica la regla (#796).
begin;
select plan(
  29 + jsonb_array_length(tests.contrato('permisos-edicion.json') -> 'grupoAjeno' -> 'casos')
);

insert into organizations (id, nombre) values
  ('b5500000-0000-0000-0000-000000000001', 'Org Test 55');

-- tp: técnico que prueba sobre lo ajeno. to: técnico creador del grupo base.
insert into auth.users (id, email) values
  ('b5500000-0000-0000-0000-0000000000a1', 'tp-55@test.local'),
  ('b5500000-0000-0000-0000-0000000000a2', 'to-55@test.local'),
  ('b5500000-0000-0000-0000-0000000000a3', 'admin-55@test.local'),
  ('b5500000-0000-0000-0000-0000000000a4', 'super-55@test.local');
update profiles set organizacion_id = 'b5500000-0000-0000-0000-000000000001' where id::text like 'b5500000-%';
update profiles set rol = 'admin' where id = 'b5500000-0000-0000-0000-0000000000a3';
update profiles set rol = 'superadmin' where id = 'b5500000-0000-0000-0000-0000000000a4';

-- Admin y superadmin quedan miembros por trigger; los técnicos, asignados.
select tests.crear_plantacion('b5500000-0000-0000-0000-000000000010', 'b5500000-0000-0000-0000-000000000001',
  'b5500000-0000-0000-0000-0000000000a3');
insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b5500000-0000-0000-0000-000000000010', 'b5500000-0000-0000-0000-0000000000a1', 'tecnico'),
  ('b5500000-0000-0000-0000-000000000010', 'b5500000-0000-0000-0000-0000000000a2', 'tecnico');

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b5500000-0000-0000-0000-000000000011', 'b5500000-0000-0000-0000-000000000010', 'Norte', 'P1'),
  ('b5500000-0000-0000-0000-000000000018', 'b5500000-0000-0000-0000-000000000010', 'Sur', 'P2');

-- Grupo base de `to`, con un árbol con foto.
insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, estado, usuario_creador) values
  ('b5500000-0000-0000-0000-000000000012', 'b5500000-0000-0000-0000-000000000010',
   'b5500000-0000-0000-0000-000000000011', 'Base', 'LB', 'linea', 'activa', 'b5500000-0000-0000-0000-0000000000a2');
insert into trees (id, group_id, posicion, sub_id, usuario_registro, foto_url) values
  ('b5500000-0000-0000-0000-000000000013', 'b5500000-0000-0000-0000-000000000012', 1, 'P1LBNN1',
   'b5500000-0000-0000-0000-0000000000a2',
   'plantations/b5500000-0000-0000-0000-000000000010/parcelas/b5500000-0000-0000-0000-000000000011/trees/b5500000-0000-0000-0000-000000000013.jpg');

insert into storage.buckets (id, name, public) values ('tree-photos', 'tree-photos', false)
  on conflict (id) do nothing;

create function pg_temp.como(p_usuario text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_usuario, true);
  set local role authenticated;
end;
$$;

create function pg_temp.foto() returns text language sql as $$
  select foto_url from trees where id = 'b5500000-0000-0000-0000-000000000013';
$$;

create function pg_temp.reponer_foto() returns void language sql as $$
  update trees set foto_url = 'antes' where id = 'b5500000-0000-0000-0000-000000000013';
$$;

-- ── sync_subgroup contra el contrato ─────────────────────────────────────────

-- Un grupo por caso: lo creó quien sube, o `to`.
create temp table casos_55 as
select c ->> 'rol' as rol, (c ->> 'creador')::boolean as creador, (c ->> 'permitido')::boolean as permitido,
       case c ->> 'rol' when 'tecnico' then 'b5500000-0000-0000-0000-0000000000a1'::uuid
                        when 'admin' then 'b5500000-0000-0000-0000-0000000000a3'::uuid
                        else 'b5500000-0000-0000-0000-0000000000a4'::uuid end as usuario,
       gen_random_uuid() as grupo, 'G' || row_number() over () as codigo
  from jsonb_array_elements(tests.contrato('permisos-edicion.json') -> 'grupoAjeno' -> 'casos') as c;
alter table casos_55 add column creador_id uuid;
update casos_55 set creador_id = case when creador then usuario else 'b5500000-0000-0000-0000-0000000000a2'::uuid end;

insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, estado, usuario_creador)
select grupo, 'b5500000-0000-0000-0000-000000000010', 'b5500000-0000-0000-0000-000000000011',
       codigo, codigo, 'linea', 'activa', creador_id
  from casos_55;

select is((select count(distinct (rol, creador))::int from casos_55),
  (select (count(distinct rol) * count(distinct creador))::int from casos_55),
  'grupoAjeno: todas las combinaciones de rol y creador, una vez');
select ok((select bool_or(permitido) and not bool_and(permitido) from casos_55),
  'grupoAjeno: trae casos permitidos y rechazados');

-- Quien sube se declara creador: un aceptado sobre un grupo ajeno no se lo apropia.
-- Un rechazo cuenta solo si es el del creador, no otro motivo.
create function pg_temp.sube(c casos_55) returns text language plpgsql as $$
declare
  v_resultado jsonb;
begin
  perform pg_temp.como(c.usuario::text);
  v_resultado := sync_subgroup(
    jsonb_build_object(
      'id', c.grupo, 'plantation_id', 'b5500000-0000-0000-0000-000000000010',
      'parcela_id', 'b5500000-0000-0000-0000-000000000011',
      'nombre', c.codigo || ' editado', 'codigo', c.codigo, 'tipo', 'linea', 'estado', 'finalizada',
      'usuario_creador', c.usuario, 'created_at', now(), 'parcela_codigo', 'P1'),
    '[]'::jsonb);
  reset role;
  return case
    when (v_resultado ->> 'success')::boolean then 'permitido'
    when v_resultado ->> 'error' = 'PERMISSION' then 'rechazado'
    else v_resultado ->> 'error'
  end;
end;
$$;

select is(pg_temp.sube(c), case when c.permitido then 'permitido' else 'rechazado' end,
          'sync_subgroup: ' || c.rol || case when c.creador then ' en su grupo' else ' en un grupo ajeno' end)
  from casos_55 c;

select is(
  (select count(*)::int from casos_55 c join groups g on g.id = c.grupo
    where not c.permitido and (g.nombre <> c.codigo or g.estado <> 'activa')),
  0, 'sync_subgroup rechazado no toca el grupo ajeno');
select is(
  (select count(*)::int from casos_55 c join groups g on g.id = c.grupo
    where c.permitido and g.nombre = c.codigo || ' editado' and g.estado = 'finalizada' and g.usuario_creador = c.creador_id),
  (select count(*)::int from casos_55 where permitido),
  'sync_subgroup aceptado aplica el grupo y no cambia su creador');

create function pg_temp.error_de_sync(p_usuario text, p_grupo jsonb) returns text language plpgsql as $$
declare
  v_resultado jsonb;
begin
  perform pg_temp.como(p_usuario);
  v_resultado := sync_subgroup(p_grupo, '[]'::jsonb);
  reset role;
  return v_resultado ->> 'error';
end;
$$;

-- El grupo base existe en P1: mandarlo en P2 es una referencia ajena, aunque además sea de otro.
select is(
  pg_temp.error_de_sync('b5500000-0000-0000-0000-0000000000a1', jsonb_build_object(
    'id', 'b5500000-0000-0000-0000-000000000012', 'plantation_id', 'b5500000-0000-0000-0000-000000000010',
    'parcela_id', 'b5500000-0000-0000-0000-000000000018',
    'nombre', 'Base', 'codigo', 'LB', 'tipo', 'linea', 'estado', 'activa',
    'usuario_creador', 'b5500000-0000-0000-0000-0000000000a1', 'created_at', now(), 'parcela_codigo', 'P2')),
  'REFERENCIA_AJENA', 'sync_subgroup: REFERENCIA_AJENA va antes que el chequeo del creador');

-- ── UPDATE de trees ──────────────────────────────────────────────────────────

select pg_temp.reponer_foto();
select pg_temp.como('b5500000-0000-0000-0000-0000000000a1');
update trees set foto_url = 'tp' where id = 'b5500000-0000-0000-0000-000000000013';
reset role;
select is(pg_temp.foto(), 'antes', 'técnico: no actualiza un árbol de un grupo ajeno');

select pg_temp.como('b5500000-0000-0000-0000-0000000000a2');
update trees set foto_url = 'to' where id = 'b5500000-0000-0000-0000-000000000013';
reset role;
select is(pg_temp.foto(), 'to', 'técnico: actualiza un árbol de su grupo');

select pg_temp.como('b5500000-0000-0000-0000-0000000000a3');
update trees set foto_url = 'admin' where id = 'b5500000-0000-0000-0000-000000000013';
reset role;
select is(pg_temp.foto(), 'admin', 'admin: actualiza un árbol de un grupo ajeno');

select pg_temp.como('b5500000-0000-0000-0000-0000000000a4');
update trees set foto_url = 'super' where id = 'b5500000-0000-0000-0000-000000000013';
reset role;
select is(pg_temp.foto(), 'super', 'superadmin: actualiza un árbol de un grupo ajeno');

-- Mover un árbol propio a un grupo ajeno también es escribir en él.
insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, estado, usuario_creador) values
  ('b5500000-0000-0000-0000-000000000014', 'b5500000-0000-0000-0000-000000000010',
   'b5500000-0000-0000-0000-000000000011', 'Propio tp', 'LP', 'linea', 'activa', 'b5500000-0000-0000-0000-0000000000a1');
insert into trees (id, group_id, posicion, sub_id, usuario_registro) values
  ('b5500000-0000-0000-0000-000000000015', 'b5500000-0000-0000-0000-000000000014', 1, 'P1LPNN1',
   'b5500000-0000-0000-0000-0000000000a1');
select pg_temp.como('b5500000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ update trees set group_id = 'b5500000-0000-0000-0000-000000000012'
     where id = 'b5500000-0000-0000-0000-000000000015' $$,
  '42501', null, 'técnico: no mueve su árbol a un grupo ajeno');
reset role;

-- ── INSERT de trees ──────────────────────────────────────────────────────────

select pg_temp.como('b5500000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ insert into trees (id, group_id, posicion, sub_id, usuario_registro)
     values ('b5500000-0000-0000-0000-000000000016', 'b5500000-0000-0000-0000-000000000012', 2, 'P1LBNN2',
             'b5500000-0000-0000-0000-0000000000a1') $$,
  '42501', null, 'técnico: no agrega un árbol a un grupo ajeno');
select lives_ok(
  $$ insert into trees (id, group_id, posicion, sub_id, usuario_registro)
     values ('b5500000-0000-0000-0000-000000000017', 'b5500000-0000-0000-0000-000000000014', 2, 'P1LPNN2',
             'b5500000-0000-0000-0000-0000000000a1') $$,
  'técnico: agrega un árbol a su grupo');
reset role;

select pg_temp.como('b5500000-0000-0000-0000-0000000000a3');
select lives_ok(
  $$ insert into trees (id, group_id, posicion, sub_id, usuario_registro)
     values ('b5500000-0000-0000-0000-000000000019', 'b5500000-0000-0000-0000-000000000012', 2, 'P1LBNN2',
             'b5500000-0000-0000-0000-0000000000a3') $$,
  'admin: agrega un árbol a un grupo ajeno');
reset role;

-- ── quitar_fotos_arboles ─────────────────────────────────────────────────────

select pg_temp.reponer_foto();
select pg_temp.como('b5500000-0000-0000-0000-0000000000a1');
select is((quitar_fotos_arboles(array['b5500000-0000-0000-0000-000000000013']::uuid[]) ->> 'quitadas')::int, 0,
  'técnico: no quita la foto de un grupo ajeno');
select is(quitar_fotos_arboles(array['b5500000-0000-0000-0000-000000000013']::uuid[]) -> 'rechazados', '[]'::jsonb,
  'técnico: el árbol ajeno no queda como rechazado (reabrir no lo destraba)');
reset role;
select is(pg_temp.foto(), 'antes', 'técnico: la foto ajena sigue');

select pg_temp.como('b5500000-0000-0000-0000-0000000000a3');
select is((quitar_fotos_arboles(array['b5500000-0000-0000-0000-000000000013']::uuid[]) ->> 'quitadas')::int, 1,
  'admin: quita la foto de un grupo ajeno');
reset role;

select pg_temp.reponer_foto();
select pg_temp.como('b5500000-0000-0000-0000-0000000000a4');
select is((quitar_fotos_arboles(array['b5500000-0000-0000-0000-000000000013']::uuid[]) ->> 'quitadas')::int, 1,
  'superadmin: quita la foto de un grupo ajeno');
reset role;

select pg_temp.reponer_foto();
select pg_temp.como('b5500000-0000-0000-0000-0000000000a2');
select is((quitar_fotos_arboles(array['b5500000-0000-0000-0000-000000000013']::uuid[]) ->> 'quitadas')::int, 1,
  'técnico: quita la foto de su grupo');
reset role;

-- ── Storage ──────────────────────────────────────────────────────────────────

select is(arbol_de_foto('plantations/x/parcelas/y/trees/b5500000-0000-0000-0000-000000000013.jpg'),
  'b5500000-0000-0000-0000-000000000013'::uuid, 'arbol_de_foto: el id del árbol sale del archivo');
select is(arbol_de_foto('plantations/x/parcelas/y/trees/previa.jpg'), null::uuid,
  'arbol_de_foto: un archivo que no es un id da NULL');

select pg_temp.como('b5500000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('tree-photos', 'plantations/b5500000-0000-0000-0000-000000000010/parcelas/b5500000-0000-0000-0000-000000000011/trees/b5500000-0000-0000-0000-000000000013.jpg') $$,
  '42501', null, 'técnico: no sube la foto de un árbol de un grupo ajeno');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('tree-photos', 'plantations/b5500000-0000-0000-0000-000000000010/parcelas/b5500000-0000-0000-0000-000000000011/trees/b5500000-0000-0000-0000-0000000000ff.jpg') $$,
  'técnico: sube la foto de un árbol que todavía no subió');
reset role;

select pg_temp.como('b5500000-0000-0000-0000-0000000000a2');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, metadata)
     values ('tree-photos', 'plantations/b5500000-0000-0000-0000-000000000010/parcelas/b5500000-0000-0000-0000-000000000011/trees/b5500000-0000-0000-0000-000000000013.jpg', '{"v": "to"}') $$,
  'técnico: sube la foto de un árbol de su grupo');
reset role;

select pg_temp.como('b5500000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, metadata)
     values ('tree-photos', 'plantations/b5500000-0000-0000-0000-000000000010/parcelas/b5500000-0000-0000-0000-000000000011/trees/b5500000-0000-0000-0000-000000000013.jpg', '{"v": "tp"}')
     on conflict (bucket_id, name) do update set metadata = excluded.metadata $$,
  '42501', null, 'técnico: no reemplaza por upsert la foto de un grupo ajeno');
update storage.objects set metadata = '{"v": "tp"}'
  where name = 'plantations/b5500000-0000-0000-0000-000000000010/parcelas/b5500000-0000-0000-0000-000000000011/trees/b5500000-0000-0000-0000-000000000013.jpg';
reset role;
select is(
  (select metadata ->> 'v' from storage.objects
    where name = 'plantations/b5500000-0000-0000-0000-000000000010/parcelas/b5500000-0000-0000-0000-000000000011/trees/b5500000-0000-0000-0000-000000000013.jpg'),
  'to', 'técnico: no actualiza la foto de un grupo ajeno');

select pg_temp.como('b5500000-0000-0000-0000-0000000000a3');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, metadata)
     values ('tree-photos', 'plantations/b5500000-0000-0000-0000-000000000010/parcelas/b5500000-0000-0000-0000-000000000011/trees/b5500000-0000-0000-0000-000000000013.jpg', '{"v": "admin"}')
     on conflict (bucket_id, name) do update set metadata = excluded.metadata $$,
  'admin: reemplaza por upsert la foto de un grupo ajeno');
reset role;

select pg_temp.como('b5500000-0000-0000-0000-0000000000a4');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, metadata)
     values ('tree-photos', 'plantations/b5500000-0000-0000-0000-000000000010/parcelas/b5500000-0000-0000-0000-000000000011/trees/b5500000-0000-0000-0000-000000000013.jpg', '{"v": "super"}')
     on conflict (bucket_id, name) do update set metadata = excluded.metadata $$,
  'superadmin: reemplaza por upsert la foto de un grupo ajeno');
reset role;
select is(
  (select metadata ->> 'v' from storage.objects
    where name = 'plantations/b5500000-0000-0000-0000-000000000010/parcelas/b5500000-0000-0000-0000-000000000011/trees/b5500000-0000-0000-0000-000000000013.jpg'),
  'super', 'los upserts de admin y superadmin se aplicaron');

select * from finish();
rollback;
