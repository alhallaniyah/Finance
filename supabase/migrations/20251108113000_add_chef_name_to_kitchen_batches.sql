/*
  # Add chef_name to kitchen_batches for display in reports

  Stores the cook's display name or email at batch creation time so
  reports can show a human-readable name without needing to join auth tables.
*/

ALTER TABLE public.kitchen_batches
  ADD COLUMN IF NOT EXISTS chef_name text;