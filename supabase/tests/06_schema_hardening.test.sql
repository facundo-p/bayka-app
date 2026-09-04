-- 030 (#306/#307): índices de FK, NOT NULL, constraint legacy retirada,
-- search_path fijo en los SECURITY DEFINER que lo tenían pendiente.
begin;
select plan(9);

select has_index('public', 'groups', 'groups_plantation_id_idx', 'existe índice sobre groups.plantation_id');
select has_index('public', 'trees', 'trees_group_id_idx', 'existe índice sobre trees.group_id');

select col_not_null('public', 'groups', 'parcela_id', 'groups.parcela_id es NOT NULL');

select ok(
  not exists (select 1 from pg_constraint where conname = 'subgroups_estado_check'),
  'subgroups_estado_check (legacy, incluía sincronizada) fue eliminada'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'groups_estado_check'),
  'groups_estado_check (la narrower, sin sincronizada) sigue existiendo'
);

select ok(
  ( select 'search_path=public' = any(proconfig) from pg_proc
    where proname = 'add_admin_memberships_to_plantation' and pronamespace = 'public'::regnamespace ),
  'add_admin_memberships_to_plantation tiene search_path=public fijo'
);

select ok(
  ( select 'search_path=public' = any(proconfig) from pg_proc
    where proname = 'sync_admin_memberships_on_rol_change' and pronamespace = 'public'::regnamespace ),
  'sync_admin_memberships_on_rol_change tiene search_path=public fijo'
);

-- bool_and(...) sobre proconfig da NULL (no false) si la función no matchea
-- o si proconfig es NULL, y NULL pasa un ok(); por eso un assert por función.
select ok(
  ( select 'search_path=public' = any(proconfig) from pg_proc
    where proname = 'sync_subgroup' and pronamespace = 'public'::regnamespace ),
  'sync_subgroup tiene search_path=public fijo'
);

select ok(
  ( select 'search_path=public' = any(proconfig) from pg_proc
    where proname = 'generate_tree_ids' and pronamespace = 'public'::regnamespace ),
  'generate_tree_ids tiene search_path=public fijo'
);

select * from finish();
rollback;
