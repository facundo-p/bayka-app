-- Add ON DELETE CASCADE to subgroups.plantation_id and trees.subgroup_id
-- so deleting a plantation from Supabase cleans up all dependent records.

-- subgroups → plantations
alter table subgroups
  drop constraint subgroups_plantation_id_fkey,
  add constraint subgroups_plantation_id_fkey
    foreign key (plantation_id) references plantations(id) on delete cascade;

-- trees → subgroups
alter table trees
  drop constraint trees_subgroup_id_fkey,
  add constraint trees_subgroup_id_fkey
    foreign key (subgroup_id) references subgroups(id) on delete cascade;
