/*
  # Add phone fields to vendors

  - Adds phone and manager_phone as nullable text fields
  - Non-breaking: existing rows remain valid
*/

ALTER TABLE IF EXISTS public.vendors
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS manager_phone text;
