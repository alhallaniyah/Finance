/*
  # Add created_by and updated_by columns via ALTER for expense module tables

  Rationale: tables were created earlier without created_by/updated_by; this migration adds them
  as alterations to avoid recreating tables.
*/

-- Vendors
ALTER TABLE IF EXISTS public.vendors
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Accounts
ALTER TABLE IF EXISTS public.accounts
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Expenses
ALTER TABLE IF EXISTS public.expenses
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Accounting periods
ALTER TABLE IF EXISTS public.accounting_periods
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Reimbursement batches
ALTER TABLE IF EXISTS public.reimbursement_batches
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Reimbursement items
ALTER TABLE IF EXISTS public.reimbursement_items
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Account transfers
ALTER TABLE IF EXISTS public.account_transfers
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Petty cash reconciliations
ALTER TABLE IF EXISTS public.petty_cash_reconciliations
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
