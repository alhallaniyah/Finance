-- Create a public storage bucket for company assets (logo/stamp)
-- Run via Supabase CLI or apply in the dashboard SQL editor

-- Create bucket if not exists
do $$
begin
  -- Create bucket via direct insert for broader compatibility
  insert into storage.buckets (id, name, public)
  values ('company-assets', 'company-assets', true)
  on conflict (id) do nothing;
end $$;

-- Policies: public read, authenticated insert
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public read company-assets'
  ) then
    create policy "Public read company-assets" on storage.objects
      for select to public
      using (bucket_id = 'company-assets');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated insert company-assets'
  ) then
    create policy "Authenticated insert company-assets" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'company-assets');
  end if;
end $$;