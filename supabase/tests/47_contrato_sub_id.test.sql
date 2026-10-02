-- contracts/sub-id.json contra el server (#735). `armado`: el SubID que arman
-- cambiar_especie_arbol y sync_subgroup al conservar la especie del server; el
-- server nunca arma un N/N, así que esos vectores solo los recorre la app.
-- `cambioDeCodigoDeParcela`: el trigger que reescribe el prefijo. La app recorre
-- los mismos vectores contra generateSubId y su reescritura.
begin;

create temp table armado_47 as
select v, gen_random_uuid() as plantacion, gen_random_uuid() as parcela,
       gen_random_uuid() as grupo, gen_random_uuid() as arbol
  from jsonb_array_elements(tests.contrato('sub-id.json') -> 'armado') as v
 where v ->> 'especie' is not null;

create temp table reescritura_47 as
select v, gen_random_uuid() as plantacion, gen_random_uuid() as parcela,
       gen_random_uuid() as grupo, gen_random_uuid() as arbol
  from jsonb_array_elements(tests.contrato('sub-id.json') -> 'cambioDeCodigoDeParcela') as v;

select plan(2 + 2 * (select count(*)::int from armado_47) + (select count(*)::int from reescritura_47));

select ok((select count(*) from armado_47) > 0, 'el contrato trae SubID que arma el server');
select ok((select count(*) from reescritura_47) > 0, 'el contrato trae cambios de código de parcela');

insert into organizations (id, nombre) values
  ('b4700000-0000-0000-0000-000000000001', 'Org Test 47');
insert into auth.users (id, email) values
  ('b4700000-0000-0000-0000-0000000000a1', 'admin-47@test.local');
update profiles set rol = 'admin', organizacion_id = 'b4700000-0000-0000-0000-000000000001'
  where id = 'b4700000-0000-0000-0000-0000000000a1';

-- La especie de partida, de la que se cambia a la del vector.
insert into species (id, codigo, nombre) values
  ('b4700000-0000-0000-0000-0000000000e0', 'T47Z', 'Partida 47');
insert into species (codigo, nombre)
select distinct v ->> 'especie', 'Especie ' || (v ->> 'especie')
  from (select v from armado_47 union all select v from reescritura_47) as todos
 where v ->> 'especie' is not null
on conflict (codigo) do nothing;

-- Una plantación por vector: los códigos de parcela pueden repetirse entre vectores.
create function pg_temp.sembrar(p_plantacion uuid, p_parcela uuid, p_grupo uuid, p_arbol uuid,
  p_parcela_codigo text, p_grupo_codigo text, p_especie uuid, p_posicion int, p_sub_id text)
returns void language plpgsql as $$
begin
  perform tests.crear_plantacion(p_plantacion, 'b4700000-0000-0000-0000-000000000001',
    'b4700000-0000-0000-0000-0000000000a1');
  insert into plantation_species (plantation_id, species_id, orden_visual)
  select p_plantacion, id, 0 from species
   where id in ('b4700000-0000-0000-0000-0000000000e0', p_especie);
  insert into parcelas (id, plantation_id, nombre, codigo) values (p_parcela, p_plantacion, 'Norte', p_parcela_codigo);
  insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, estado, usuario_creador)
  values (p_grupo, p_plantacion, p_parcela, 'Uno', p_grupo_codigo, 'linea', 'activa',
    'b4700000-0000-0000-0000-0000000000a1');
  insert into trees (id, group_id, species_id, posicion, sub_id, usuario_registro)
  values (p_arbol, p_grupo, p_especie, p_posicion, p_sub_id, 'b4700000-0000-0000-0000-0000000000a1');
end;
$$;

create function pg_temp.especie(p_codigo text) returns uuid language sql as $$
  select id from species where codigo = p_codigo;
$$;

select pg_temp.sembrar(plantacion, parcela, grupo, arbol, v ->> 'parcela', v ->> 'grupo',
  pg_temp.especie(v ->> 'especie'), (v ->> 'posicion')::int, 'sin-armar')
  from armado_47;
select pg_temp.sembrar(plantacion, parcela, grupo, arbol, v ->> 'anterior', v ->> 'grupo',
  pg_temp.especie(v ->> 'especie'), (v ->> 'posicion')::int, v ->> 'subIdAntes')
  from reescritura_47;

-- sync_subgroup arma el SubID cuando conserva la especie del server: el árbol
-- tiene la del vector y sube con otra como base.

select is(
  sync_subgroup_conservar_especies(
    jsonb_build_object('parcela_codigo', v ->> 'parcela', 'codigo', v ->> 'grupo'),
    jsonb_build_array(jsonb_build_object('id', arbol, 'posicion', (v ->> 'posicion')::int,
      'species_id', 'b4700000-0000-0000-0000-0000000000e0',
      'species_base_id', 'b4700000-0000-0000-0000-0000000000e0'))) -> 0 ->> 'sub_id',
  v ->> 'subId',
  'sync_subgroup conserva la especie y arma ' || (v ->> 'subId'))
  from armado_47;

-- cambiar_especie_arbol, desde la especie de partida a la del vector.
update trees t set species_id = 'b4700000-0000-0000-0000-0000000000e0'
  from armado_47 a where t.id = a.arbol;
alter table armado_47 add column especie uuid;
update armado_47 set especie = pg_temp.especie(v ->> 'especie');
grant select on armado_47 to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b4700000-0000-0000-0000-0000000000a1', true);

select is(
  cambiar_especie_arbol(arbol, especie, 'b4700000-0000-0000-0000-0000000000e0') ->> 'sub_id',
  v ->> 'subId',
  'cambiar_especie_arbol arma ' || (v ->> 'subId'))
  from armado_47;

reset role;

update parcelas p set codigo = r.v ->> 'nuevo' from reescritura_47 r where p.id = r.parcela;

select is((select sub_id from trees where id = arbol), v ->> 'subIdDespues',
          'cambiar el código de parcela reescribe ' || (v ->> 'subIdAntes') || ' a ' || (v ->> 'subIdDespues'))
  from reescritura_47;

select * from finish();
rollback;
