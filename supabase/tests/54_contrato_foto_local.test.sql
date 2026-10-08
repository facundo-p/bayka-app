-- contracts/foto-local.json contra dashboard_arboles (#762): un árbol con foto
-- de cada esquema local del contrato no cuenta como foto. La web y mobile
-- recorren el mismo contrato.
begin;

-- Un mes por esquema, para leer cada árbol en su propia fila del dashboard.
create temp table esquemas_54 as
select n, esquema, '2026-01-15'::timestamptz + (n - 1) * interval '1 month' as creado
  from jsonb_array_elements_text(tests.contrato('foto-local.json') -> 'esquemas')
       with ordinality as e(esquema, n);

select plan(2 + (select count(*)::int from esquemas_54));

select ok((select count(*) from esquemas_54) > 0, 'el contrato trae esquemas');

insert into organizations (id, nombre) values
  ('b5400000-0000-0000-0000-000000000001', 'Org Test 54');
insert into auth.users (id, email) values
  ('b5400000-0000-0000-0000-0000000000a1', 'admin-54@test.local');
update profiles set organizacion_id = 'b5400000-0000-0000-0000-000000000001', rol = 'admin'
  where id = 'b5400000-0000-0000-0000-0000000000a1';

select tests.crear_plantacion('b5400000-0000-0000-0000-000000000010', 'b5400000-0000-0000-0000-000000000001',
  'b5400000-0000-0000-0000-0000000000a1', 'P 54');
insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b5400000-0000-0000-0000-000000000011', 'b5400000-0000-0000-0000-000000000010', 'Parcela 54', 'PA54');
insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador) values
  ('b5400000-0000-0000-0000-000000000012', 'b5400000-0000-0000-0000-000000000010',
   'b5400000-0000-0000-0000-000000000011', 'G54', 'G54', 'linea', 'b5400000-0000-0000-0000-0000000000a1');

-- Un árbol por esquema, más el de control con foto subida en un mes que no usa
-- ningún esquema.
insert into trees (group_id, posicion, sub_id, usuario_registro, foto_url, created_at)
select 'b5400000-0000-0000-0000-000000000012', n, 'A' || n, 'b5400000-0000-0000-0000-0000000000a1',
       esquema || 'foto-' || n || '.jpg', creado
  from esquemas_54
union all
select 'b5400000-0000-0000-0000-000000000012', 0, 'A0', 'b5400000-0000-0000-0000-0000000000a1',
       'plantations/p54/trees/a0.jpg', '2025-12-15T12:00:00Z';

create function pg_temp.con_foto_54(p_mes text) returns boolean
language sql as $$
  select (x ->> 'con_foto')::boolean
    from jsonb_array_elements(dashboard_arboles('b5400000-0000-0000-0000-000000000010')) as x
   where x ->> 'mes' = p_mes
$$;

grant select on esquemas_54 to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b5400000-0000-0000-0000-0000000000a1', true);

select is(pg_temp.con_foto_54('2025-12'), true, 'una foto subida cuenta como foto');

select is(pg_temp.con_foto_54(to_char(creado at time zone 'UTC', 'YYYY-MM')), false,
          format('una foto %s no cuenta como foto', esquema))
  from esquemas_54;

select * from finish();
rollback;
