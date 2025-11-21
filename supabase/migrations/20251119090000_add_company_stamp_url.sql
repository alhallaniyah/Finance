-- Add company_stamp_url column to company_settings for stamp image
alter table if exists company_settings
  add column if not exists company_stamp_url text;

-- No changes to RLS needed; column is nullable and covered by existing policies