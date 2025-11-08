/*
  # Add display_name to company_users

  Stores a human-readable name for each company user that can be used
  in reports and batch records without needing to query auth metadata.
*/

ALTER TABLE public.company_users
  ADD COLUMN IF NOT EXISTS display_name text;