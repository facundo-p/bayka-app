-- contracts/tipos-especie.json contra species (#752): el CHECK acepta cada par
-- tipo/subtipo del contrato y ninguno más, y los DEFAULT son la clasificación
-- por defecto. La web y mobile recorren el mismo contrato.
begin;

create temp table pares_52 as
select row_number() over () as n, t.key as tipo, s.subtipo
  from jsonb_each(tests.contrato('tipos-especie.json') -> 'subtiposPorTipo') as t,
       jsonb_array_elements_text(t.value) as s(subtipo);

select plan(5 + (select count(*)::int from pares_52));

select ok((select count(*) from pares_52) > 0, 'el contrato trae pares tipo/subtipo');

select lives_ok(
  format('insert into species (codigo, nombre, tipo, subtipo) values (%L, %L, %L, %L)',
         'T52' || n, 'Especie 52 ' || n, tipo, subtipo),
  format('acepta %s / %s', tipo, subtipo))
  from pares_52;

select throws_ok(
  $$insert into species (codigo, nombre, tipo, subtipo) values ('T52X', 'Hongo', 'flora', 'hongo')$$,
  '23514', null, 'rechaza un subtipo fuera del contrato');

select throws_ok(
  $$insert into species (codigo, nombre, tipo, subtipo) values ('T52Y', 'Fauna', 'fauna', 'arbol')$$,
  '23514', null, 'rechaza un tipo fuera del contrato');

-- Postgres guarda el IN de pares como un OR de (tipo = … AND subtipo = …). Así
-- también falla quitar un par del contrato sin quitarlo de la base.
select set_eq(
  $$select m[1] as tipo, m[2] as subtipo
      from pg_constraint c,
           regexp_matches(pg_get_constraintdef(c.oid),
                          'tipo = ''([^'']+)''::text\) AND \(subtipo = ''([^'']+)''::text', 'g') as m
     where c.conname = 'species_tipo_subtipo_valido'$$,
  $$select tipo, subtipo from pares_52$$,
  'el CHECK nombra exactamente los pares del contrato');

insert into species (codigo, nombre) values ('T52D', 'Sin clasificar');
select is(
  (select jsonb_build_object('tipo', tipo, 'subtipo', subtipo) from species where codigo = 'T52D'),
  tests.contrato('tipos-especie.json') -> 'porDefecto',
  'una especie insertada sin clasificación toma la del contrato');

select * from finish();
rollback;
