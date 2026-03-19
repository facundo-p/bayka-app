-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- organizations
create table organizations (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz not null default now()
);

-- profiles (extends auth.users — one profile per auth user)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  rol text not null check (rol in ('admin', 'tecnico')),
  organizacion_id uuid references organizations(id),
  created_at timestamptz not null default now()
);

-- species (global catalog)
create table species (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  nombre_cientifico text,
  created_at timestamptz not null default now()
);

-- plantations
create table plantations (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizations(id),
  lugar text not null,
  periodo text not null,
  estado text not null default 'activa' check (estado in ('activa', 'finalizada')),
  creado_por uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- plantation_species (species available in a plantation's UI, with visual order)
create table plantation_species (
  plantation_id uuid not null references plantations(id) on delete cascade,
  species_id uuid not null references species(id),
  orden_visual integer not null default 0,
  primary key (plantation_id, species_id)
);

-- plantation_users (technicians assigned to a plantation)
create table plantation_users (
  plantation_id uuid not null references plantations(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  rol_en_plantacion text not null default 'tecnico',
  assigned_at timestamptz not null default now(),
  primary key (plantation_id, user_id)
);

-- subgroups
create table subgroups (
  id uuid primary key default gen_random_uuid(),
  plantation_id uuid not null references plantations(id),
  nombre text not null,
  codigo text not null,
  tipo text not null default 'linea' check (tipo in ('linea', 'parcela')),
  estado text not null default 'activa' check (estado in ('activa', 'finalizada', 'sincronizada')),
  usuario_creador uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (plantation_id, codigo),
  unique (plantation_id, nombre)
);

-- trees
create table trees (
  id uuid primary key default gen_random_uuid(),
  subgroup_id uuid not null references subgroups(id),
  species_id uuid references species(id),
  posicion integer not null,
  sub_id text not null,
  foto_url text,
  plantacion_id integer,
  global_id integer,
  usuario_registro uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- Row Level Security: enable on all tables
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table species enable row level security;
alter table plantations enable row level security;
alter table plantation_species enable row level security;
alter table plantation_users enable row level security;
alter table subgroups enable row level security;
alter table trees enable row level security;

-- RLS Policies

-- profiles: users can read their own profile
create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = id);

-- profiles: users can update their own profile
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- species: all authenticated users can read species
create policy "Authenticated users can read species"
  on species for select
  to authenticated
  using (true);

-- plantations: authenticated users in same org can read
create policy "Authenticated users can read plantations"
  on plantations for select
  to authenticated
  using (true);

-- plantation_species: authenticated users can read
create policy "Authenticated users can read plantation_species"
  on plantation_species for select
  to authenticated
  using (true);

-- plantation_users: authenticated users can read
create policy "Authenticated users can read plantation_users"
  on plantation_users for select
  to authenticated
  using (true);

-- subgroups: authenticated users can read
create policy "Authenticated users can read subgroups"
  on subgroups for select
  to authenticated
  using (true);

-- subgroups: creator can insert
create policy "Users can insert own subgroups"
  on subgroups for insert
  to authenticated
  with check (auth.uid() = usuario_creador);

-- trees: authenticated users can read
create policy "Authenticated users can read trees"
  on trees for select
  to authenticated
  using (true);

-- trees: creator can insert
create policy "Users can insert own trees"
  on trees for insert
  to authenticated
  with check (auth.uid() = usuario_registro);
