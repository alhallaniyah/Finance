-- Add company_phone to store a POS-friendly phone/contact number
alter table if exists company_settings
  add column if not exists company_phone text;
