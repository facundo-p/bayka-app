-- Migration 027: FK plantation_users → profiles + stats de plantaciones agregadas
--
-- 1. plantation_users.user_id solo referenciaba auth.users, que no está en el
--    schema public: PostgREST no podía resolver el embed profiles(nombre, rol)
--    de la web (PGRST200) y la sección "Técnicos asignados" fallaba siempre.
--    Desde la 026 todo auth user tiene su fila en profiles (backfill + trigger
--    handle_new_user), así que la FK es válida por construcción. Se mantiene la
--    semántica de borrado existente (restrict): los usuarios se dan de baja con
--    activo=false, nunca se borran.
-- 2. stats_plantaciones(): el listado web hacía 3 counts HEAD por plantación
--    (N+1, 27+ requests simultáneos con pocas plantaciones) y saturaba el
--    pooler del tier Free (503). Una sola query agregada devuelve los tres
--    contadores de todas las plantaciones. security invoker: aplica la RLS del
--    caller, igual que los counts que reemplaza.

alter table plantation_users
  add constraint plantation_users_user_id_profiles_fkey
  foreign key (user_id) references profiles(id);

create or replace function stats_plantaciones()
returns table (plantation_id uuid, arboles bigint, parcelas bigint, usuarios bigint)
language sql stable security invoker set search_path = public as $$
  select
    p.id,
    (select count(*) from trees t join groups g on g.id = t.group_id
      where g.plantation_id = p.id),
    (select count(*) from parcelas pa
      where pa.plantation_id = p.id and pa.deleted_at is null),
    (select count(*) from plantation_users pu
      where pu.plantation_id = p.id)
  from plantations p
$$;
