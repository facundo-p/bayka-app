-- Lugar de color fijo de cada especie en su plantación (079, #845): el relleno
-- conserva el orden por código de la web, el alta toma el menor lugar libre, un
-- lugar liberado se reutiliza, los escritores existentes conservan los lugares
-- y el índice no deja repetir un lugar. N/N, el sentinela del contrato, no ocupa.
begin;
select plan(16);

insert into organizations (id, nombre) values
  ('b6200000-0000-0000-0000-000000000001', 'Org Test 62');

insert into auth.users (id, email) values
  ('b6200000-0000-0000-0000-0000000000a1', 'admin-62@test.local'),
  ('b6200000-0000-0000-0000-0000000000a2', 'tecnico-62@test.local');

update profiles set rol = 'admin', organizacion_id = 'b6200000-0000-0000-0000-000000000001'
  where id = 'b6200000-0000-0000-0000-0000000000a1';
update profiles set organizacion_id = 'b6200000-0000-0000-0000-000000000001'
  where id = 'b6200000-0000-0000-0000-0000000000a2';

-- Minúscula, mayúsculas y Ñ: en orden binario (el del `.sort()` de JS) van
-- A < C < b < Ñ; con una colación de idioma, b iría antes que C.
insert into species (id, codigo, nombre) values
  ('b6200000-0000-0000-0000-0000000000e1', 'T62b', 'Especie b 62'),
  ('b6200000-0000-0000-0000-0000000000e2', 'T62C', 'Especie C 62'),
  ('b6200000-0000-0000-0000-0000000000e3', 'T62A', 'Especie A 62'),
  ('b6200000-0000-0000-0000-0000000000e4', 'T62Ñ', 'Especie Ñ 62'),
  ('b6200000-0000-0000-0000-0000000000e5', 'T62D', 'Especie D 62'),
  ('b6200000-0000-0000-0000-0000000000e6', 'T62E', 'Especie E 62');
insert into species (codigo, nombre)
  values (tests.contrato('species-sentinel.json') ->> 'code', 'Sin identificar')
  on conflict (codigo) do nothing;

create temp table nn_62 as
  select id from species where codigo = tests.contrato('species-sentinel.json') ->> 'code';
grant select on nn_62 to authenticated;

-- 1: relleno. 2: ya tiene lugares. 3: altas y bajas.
select tests.crear_plantacion('b6200000-0000-0000-0000-000000000011', 'b6200000-0000-0000-0000-000000000001',
  'b6200000-0000-0000-0000-0000000000a1', 'Relleno 62');
select tests.crear_plantacion('b6200000-0000-0000-0000-000000000012', 'b6200000-0000-0000-0000-000000000001',
  'b6200000-0000-0000-0000-0000000000a1', 'Asignada 62');
select tests.crear_plantacion('b6200000-0000-0000-0000-000000000013', 'b6200000-0000-0000-0000-000000000001',
  'b6200000-0000-0000-0000-0000000000a1', 'Cambios 62');

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b6200000-0000-0000-0000-000000000013', 'b6200000-0000-0000-0000-0000000000a2', 'tecnico');

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b6200000-0000-0000-0000-0000000000b1', 'b6200000-0000-0000-0000-000000000013', 'Norte', 'P1');

insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador) values
  ('b6200000-0000-0000-0000-0000000000c1', 'b6200000-0000-0000-0000-000000000013',
   'b6200000-0000-0000-0000-0000000000b1', 'Uno', 'L1', 'linea', 'b6200000-0000-0000-0000-0000000000a2');

-- `T62b:0, T62C:1, NN:-` en orden binario de código; `-` = sin lugar.
create function pg_temp.lugares_62(p_plantacion uuid) returns text
  language sql stable as $$
  select string_agg(s.codigo || ':' || coalesce(ps.lugar_color::text, '-'), ', ' order by s.codigo collate "C")
  from plantation_species ps join species s on s.id = ps.species_id
  where ps.plantation_id = p_plantacion;
$$;
grant execute on function pg_temp.lugares_62(uuid) to authenticated;

select has_column('public', 'plantation_species', 'lugar_color', 'plantation_species tiene lugar_color');

-- ── Relleno ──────────────────────────────────────────────────────────────────

-- El trigger les da lugares por orden de alta, que no es el de código.
insert into plantation_species (plantation_id, species_id) values
  ('b6200000-0000-0000-0000-000000000011', 'b6200000-0000-0000-0000-0000000000e1'),
  ('b6200000-0000-0000-0000-000000000011', 'b6200000-0000-0000-0000-0000000000e2'),
  ('b6200000-0000-0000-0000-000000000011', (select id from nn_62)),
  ('b6200000-0000-0000-0000-000000000011', 'b6200000-0000-0000-0000-0000000000e3'),
  ('b6200000-0000-0000-0000-000000000011', 'b6200000-0000-0000-0000-0000000000e4');
insert into plantation_species (plantation_id, species_id) values
  ('b6200000-0000-0000-0000-000000000012', 'b6200000-0000-0000-0000-0000000000e2'),
  ('b6200000-0000-0000-0000-000000000012', 'b6200000-0000-0000-0000-0000000000e1');

-- La plantación 1 vuelve al estado previo a la migración.
update plantation_species set lugar_color = null
 where plantation_id = 'b6200000-0000-0000-0000-000000000011';
select rellenar_lugares_color();

select is(pg_temp.lugares_62('b6200000-0000-0000-0000-000000000011'),
  'NN:-, T62A:0, T62C:1, T62b:2, T62Ñ:3',
  'el relleno sigue el orden binario del código, y N/N queda sin lugar');
select is(pg_temp.lugares_62('b6200000-0000-0000-0000-000000000012'),
  'T62C:0, T62b:1',
  'el relleno no reordena una plantación que ya tiene lugares');

-- ── Altas y bajas ────────────────────────────────────────────────────────────

insert into plantation_species (plantation_id, species_id, lugar_color) values
  ('b6200000-0000-0000-0000-000000000013', 'b6200000-0000-0000-0000-0000000000e1', 7);
select is(pg_temp.lugares_62('b6200000-0000-0000-0000-000000000013'), 'T62b:0',
  'el lugar lo asigna el server, aunque el cliente mande otro');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b6200000-0000-0000-0000-0000000000a1', true);

select aplicar_cambios_especies('b6200000-0000-0000-0000-000000000013',
  array['b6200000-0000-0000-0000-0000000000e2']::uuid[], '{}');
select aplicar_cambios_especies('b6200000-0000-0000-0000-000000000013',
  array['b6200000-0000-0000-0000-0000000000e3']::uuid[], '{}');
select aplicar_cambios_especies('b6200000-0000-0000-0000-000000000013',
  array[(select id from nn_62)]::uuid[], '{}');
select aplicar_cambios_especies('b6200000-0000-0000-0000-000000000013',
  array['b6200000-0000-0000-0000-0000000000e4']::uuid[], '{}');
select is(pg_temp.lugares_62('b6200000-0000-0000-0000-000000000013'),
  'NN:-, T62A:2, T62C:1, T62b:0, T62Ñ:3',
  'cada alta toma el menor lugar libre, y N/N no ocupa ninguno');

select aplicar_cambios_especies('b6200000-0000-0000-0000-000000000013', '{}',
  array['b6200000-0000-0000-0000-0000000000e2']::uuid[]);
select aplicar_cambios_especies('b6200000-0000-0000-0000-000000000013',
  array['b6200000-0000-0000-0000-0000000000e5']::uuid[], '{}');
select is(pg_temp.lugares_62('b6200000-0000-0000-0000-000000000013'),
  'NN:-, T62A:2, T62D:1, T62b:0, T62Ñ:3',
  'la especie nueva toma el lugar liberado y ninguna otra cambia');

select aplicar_cambios_especies('b6200000-0000-0000-0000-000000000013',
  array['b6200000-0000-0000-0000-0000000000e6']::uuid[],
  array['b6200000-0000-0000-0000-0000000000e3']::uuid[]);
select is(pg_temp.lugares_62('b6200000-0000-0000-0000-000000000013'),
  'NN:-, T62D:1, T62E:2, T62b:0, T62Ñ:3',
  'en un mismo cambio, la alta toma el lugar de la baja');

-- El teléfono manda todas sus especies como altas en cada sincronización.
select aplicar_cambios_especies('b6200000-0000-0000-0000-000000000013',
  array['b6200000-0000-0000-0000-0000000000e1', 'b6200000-0000-0000-0000-0000000000e4',
        'b6200000-0000-0000-0000-0000000000e5', 'b6200000-0000-0000-0000-0000000000e6',
        (select id from nn_62)]::uuid[], '{}');
select is(pg_temp.lugares_62('b6200000-0000-0000-0000-000000000013'),
  'NN:-, T62D:1, T62E:2, T62b:0, T62Ñ:3',
  'reenviar especies ya habilitadas no les cambia el lugar');

-- Una plantación que sube varias especies juntas las ordena como el relleno.
select aplicar_cambios_especies('b6200000-0000-0000-0000-000000000012',
  array['b6200000-0000-0000-0000-0000000000e4', 'b6200000-0000-0000-0000-0000000000e5',
        'b6200000-0000-0000-0000-0000000000e3']::uuid[], '{}');
select is(pg_temp.lugares_62('b6200000-0000-0000-0000-000000000012'),
  'T62A:2, T62C:0, T62D:3, T62b:1, T62Ñ:4',
  'varias altas juntas toman los lugares libres en orden de código');

select ok(exists (
    select 1 from pg_locks
    where locktype = 'advisory' and pid = pg_backend_pid() and objsubid = 2
      and classid = (hashtext('lugar_color')::bigint & 4294967295)::oid
      and objid = (hashtext('b6200000-0000-0000-0000-000000000013')::bigint & 4294967295)::oid),
  'las altas de una plantación se serializan con un lock propio de la plantación');

-- ── sync_subgroup ────────────────────────────────────────────────────────────

-- Libera el 1. T62A (que tenía el 2, hoy de T62E) vuelve por un árbol que sube.
select aplicar_cambios_especies('b6200000-0000-0000-0000-000000000013', '{}',
  array['b6200000-0000-0000-0000-0000000000e5']::uuid[]);

select set_config('request.jwt.claim.sub', 'b6200000-0000-0000-0000-0000000000a2', true);
select is(
  ( select sync_subgroup(
      jsonb_build_object(
        'id', 'b6200000-0000-0000-0000-0000000000c1',
        'plantation_id', 'b6200000-0000-0000-0000-000000000013',
        'parcela_id', 'b6200000-0000-0000-0000-0000000000b1',
        'parcela_codigo', 'P1',
        'nombre', 'Uno', 'codigo', 'L1', 'tipo', 'linea', 'estado', 'finalizada',
        'usuario_creador', 'b6200000-0000-0000-0000-0000000000a2', 'created_at', now()),
      jsonb_build_array(
        jsonb_build_object('id', 'b6200000-0000-0000-0000-0000000000d1',
          'group_id', 'b6200000-0000-0000-0000-0000000000c1', 'posicion', 1,
          'species_id', 'b6200000-0000-0000-0000-0000000000e1',
          'sub_id', 'P1L1T62b1', 'usuario_registro', 'b6200000-0000-0000-0000-0000000000a2',
          'created_at', now()),
        jsonb_build_object('id', 'b6200000-0000-0000-0000-0000000000d2',
          'group_id', 'b6200000-0000-0000-0000-0000000000c1', 'posicion', 2,
          'species_id', 'b6200000-0000-0000-0000-0000000000e3',
          'sub_id', 'P1L1T62A2', 'usuario_registro', 'b6200000-0000-0000-0000-0000000000a2',
          'created_at', now())
      )
    ) ->> 'success' ),
  'true', 'sync_subgroup sube árboles de una especie habilitada y de una quitada');
select is(pg_temp.lugares_62('b6200000-0000-0000-0000-000000000013'),
  'NN:-, T62A:1, T62E:2, T62b:0, T62Ñ:3',
  'la especie que re-habilita sync_subgroup toma el menor libre; la habilitada conserva el suyo');

-- ── Reemplazo de la lista entera (APKs viejos) ───────────────────────────────

select set_config('request.jwt.claim.sub', 'b6200000-0000-0000-0000-0000000000a1', true);
select is(
  (select reemplazar_especies_plantacion('b6200000-0000-0000-0000-000000000013',
    jsonb_build_array(
      jsonb_build_object('species_id', 'b6200000-0000-0000-0000-0000000000e1'),
      jsonb_build_object('species_id', 'b6200000-0000-0000-0000-0000000000e3'),
      jsonb_build_object('species_id', 'b6200000-0000-0000-0000-0000000000e5'),
      jsonb_build_object('species_id', 'b6200000-0000-0000-0000-0000000000e6'),
      jsonb_build_object('species_id', (select id from nn_62)))) ->> 'success'),
  'true', 'reemplazar_especies_plantacion quita T62Ñ y suma T62D');
select is(pg_temp.lugares_62('b6200000-0000-0000-0000-000000000013'),
  'NN:-, T62A:1, T62D:3, T62E:2, T62b:0',
  'las que siguen conservan su lugar y la nueva toma el que dejó la quitada');

-- ── Restricciones ────────────────────────────────────────────────────────────

reset role;
select throws_ok(
  $$ update plantation_species set lugar_color = 0
     where plantation_id = 'b6200000-0000-0000-0000-000000000013'
       and species_id = 'b6200000-0000-0000-0000-0000000000e3' $$,
  '23505'::character(5), null::text, 'dos especies de una plantación no comparten lugar');
select throws_ok(
  $$ update plantation_species set lugar_color = -1
     where plantation_id = 'b6200000-0000-0000-0000-000000000013'
       and species_id = 'b6200000-0000-0000-0000-0000000000e3' $$,
  '23514'::character(5), null::text, 'no hay lugares negativos');

select * from finish();
rollback;
