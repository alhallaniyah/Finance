/*
  # Extend expenses with VAT detail and receipt flags (non-breaking)

  - Adds nullable VAT metadata fields to support richer VAT handling
  - Adds reimbursable and receipt flags with safe defaults
  - No data backfill; existing rows remain valid
*/

ALTER TABLE IF EXISTS public.expenses
  ADD COLUMN IF NOT EXISTS vat_input_type text,
  ADD COLUMN IF NOT EXISTS vat_treatment text,
  ADD COLUMN IF NOT EXISTS recoverable_vat_amount numeric,
  ADD COLUMN IF NOT EXISTS non_recoverable_vat_amount numeric,
  ADD COLUMN IF NOT EXISTS is_reimbursable boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS receipt_url text,
  ADD COLUMN IF NOT EXISTS has_receipt boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS receipt_lost boolean DEFAULT false;
