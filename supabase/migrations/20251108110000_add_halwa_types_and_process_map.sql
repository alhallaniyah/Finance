-- Kitchen Halwa Types and Process Map
-- PostgreSQL-compatible migration using DROP IF EXISTS then CREATE

begin;

-- Drop dependent tables first (map depends on types)
drop table if exists public.kitchen_halwa_process_map cascade;
drop table if exists public.kitchen_halwa_types cascade;

-- Table: kitchen_halwa_types
create table public.kitchen_halwa_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  name text not null,
  base_process_count int not null default 10,
  active boolean not null default true,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

-- Unique per company
drop index if exists kitchen_halwa_types_company_name_unique;
create unique index kitchen_halwa_types_company_name_unique
  on public.kitchen_halwa_types (company_id, name);

-- Index for scoping
drop index if exists kitchen_halwa_types_company_idx;
create index kitchen_halwa_types_company_idx
  on public.kitchen_halwa_types (company_id);

-- Table: kitchen_halwa_process_map
create table public.kitchen_halwa_process_map (
  id uuid primary key default gen_random_uuid(),
  halwa_type_id uuid not null references public.kitchen_halwa_types(id) on delete cascade,
  process_type_id uuid not null references public.kitchen_process_types(id),
  sequence_order int not null default 1,
  additional_processes int not null default 0,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

-- Unique mapping per halwa/process pair
drop index if exists kitchen_halwa_process_map_unique;
create unique index kitchen_halwa_process_map_unique
  on public.kitchen_halwa_process_map (halwa_type_id, process_type_id);

-- Index for halwa type joins
drop index if exists kitchen_halwa_process_map_halwa_idx;
create index kitchen_halwa_process_map_halwa_idx
  on public.kitchen_halwa_process_map (halwa_type_id, sequence_order);

-- Enable RLS
alter table public.kitchen_halwa_types enable row level security;
alter table public.kitchen_halwa_process_map enable row level security;

-- Policies: company scoping via company_users
-- Select: company members can read
create policy kitchen_halwa_types_select on public.kitchen_halwa_types
  for select using (
    exists (
      select 1 from public.company_users cu
      where cu.user_id = auth.uid() and cu.company_id = kitchen_halwa_types.company_id
    )
  );

-- Insert: admin can create within their company
create policy kitchen_halwa_types_insert on public.kitchen_halwa_types
  for insert with check (
    exists (
      select 1 from public.company_users cu
      where cu.user_id = auth.uid() and cu.company_id = kitchen_halwa_types.company_id and cu.role = 'admin'
    )
  );

-- Update: admin can update within their company
create policy kitchen_halwa_types_update on public.kitchen_halwa_types
  for update using (
    exists (
      select 1 from public.company_users cu
      where cu.user_id = auth.uid() and cu.company_id = kitchen_halwa_types.company_id and cu.role = 'admin'
    )
  );

-- Delete: admin can delete within their company
create policy kitchen_halwa_types_delete on public.kitchen_halwa_types
  for delete using (
    exists (
      select 1 from public.company_users cu
      where cu.user_id = auth.uid() and cu.company_id = kitchen_halwa_types.company_id and cu.role = 'admin'
    )
  );

-- Policies for kitchen_halwa_process_map use halwa_type ownership for scoping
create policy kitchen_halwa_process_map_select on public.kitchen_halwa_process_map
  for select using (
    exists (
      select 1 from public.kitchen_halwa_types ht
      join public.company_users cu on cu.company_id = ht.company_id
      where ht.id = kitchen_halwa_process_map.halwa_type_id and cu.user_id = auth.uid()
    )
  );

create policy kitchen_halwa_process_map_insert on public.kitchen_halwa_process_map
  for insert with check (
    exists (
      select 1 from public.kitchen_halwa_types ht
      join public.company_users cu on cu.company_id = ht.company_id
      where ht.id = kitchen_halwa_process_map.halwa_type_id and cu.user_id = auth.uid() and cu.role = 'admin'
    )
  );

create policy kitchen_halwa_process_map_update on public.kitchen_halwa_process_map
  for update using (
    exists (
      select 1 from public.kitchen_halwa_types ht
      join public.company_users cu on cu.company_id = ht.company_id
      where ht.id = kitchen_halwa_process_map.halwa_type_id and cu.user_id = auth.uid() and cu.role = 'admin'
    )
  );

create policy kitchen_halwa_process_map_delete on public.kitchen_halwa_process_map
  for delete using (
    exists (
      select 1 from public.kitchen_halwa_types ht
      join public.company_users cu on cu.company_id = ht.company_id
      where ht.id = kitchen_halwa_process_map.halwa_type_id and cu.user_id = auth.uid() and cu.role = 'admin'
    )
  );

commit;