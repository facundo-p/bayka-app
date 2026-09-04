-- update_tree_ids(jsonb) (020) fue retirada en 030: sin caller, superseded por
-- generate_tree_ids (029).
begin;
select plan(1);
select hasnt_function('public', 'update_tree_ids', ARRAY['jsonb'], 'update_tree_ids(jsonb) ya no existe');
select * from finish();
rollback;
