-- 035 (#439): plantations.photo_capture_all_trees, flag de "foto en todos los
-- botones" administrado desde la web. NOT NULL con default false para que las
-- plantaciones existentes y los clientes que no envían la columna no cambien
-- de comportamiento.
begin;
select plan(3);

select has_column('public', 'plantations', 'photo_capture_all_trees', 'existe plantations.photo_capture_all_trees');
select col_not_null('public', 'plantations', 'photo_capture_all_trees', 'photo_capture_all_trees es NOT NULL');
select col_default_is('public', 'plantations', 'photo_capture_all_trees', 'false', 'photo_capture_all_trees defaultea a false');

select * from finish();
rollback;
