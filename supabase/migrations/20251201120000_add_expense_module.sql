/*
  # Expense Management Module (Expenses, Vendors, Accounts, Periods, Petty Cash, Reimbursements)

  - Adds core tables: vendors, accounts, expenses, accounting_periods
  - Adds supporting tables: reimbursement_batches, reimbursement_items, account_transfers, petty_cash_reconciliations
  - Applies multi-tenant scoping via company_id with tg_set_company_id trigger
  - Enables RLS with company/role-based policies
*/

-- Ensure UUID generation is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Vendors
CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('supplier','utility','landlord','government','other')) DEFAULT 'supplier',
  vat_trn text,
  country text,
  default_vat_rate numeric(6,3) DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendors_company ON public.vendors(company_id);
CREATE INDEX IF NOT EXISTS idx_vendors_active ON public.vendors(is_active);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_company_id_vendors') THEN
    CREATE TRIGGER set_company_id_vendors
    BEFORE INSERT ON public.vendors
    FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();
  END IF;
END $$;

-- Accounts
CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('bank','cash','petty_cash','employee','credit_card')),
  currency text NOT NULL DEFAULT 'AED',
  opening_balance numeric NOT NULL DEFAULT 0,
  current_balance numeric NOT NULL DEFAULT 0,
  linked_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounts_company ON public.accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON public.accounts(type);
CREATE INDEX IF NOT EXISTS idx_accounts_active ON public.accounts(is_active);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_company_id_accounts') THEN
    CREATE TRIGGER set_company_id_accounts
    BEFORE INSERT ON public.accounts
    FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();
  END IF;
END $$;

-- Accounting periods (locking)
CREATE TABLE IF NOT EXISTS public.accounting_periods (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_year smallint NOT NULL,
  period_month smallint NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status text NOT NULL CHECK (status IN ('open','locked','backfill_locked')) DEFAULT 'open',
  locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  locked_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT accounting_periods_pk PRIMARY KEY (company_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_accounting_periods_status ON public.accounting_periods(status);

-- Expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT,
  expense_date date NOT NULL,
  submission_date date NOT NULL DEFAULT CURRENT_DATE,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  gross_amount numeric NOT NULL,
  net_amount numeric NOT NULL,
  vat_amount numeric NOT NULL DEFAULT 0,
  vat_rate numeric(6,3) NOT NULL DEFAULT 0,
  vat_recoverable boolean NOT NULL DEFAULT true,
  currency text NOT NULL DEFAULT 'AED',
  category text,
  subcategory text,
  business_purpose text,
  project_id text,
  cost_center_id text,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  paid_by text NOT NULL CHECK (paid_by IN ('company','employee')),
  employee_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reimbursement_status text NOT NULL CHECK (reimbursement_status IN ('not_required','pending','partial','reimbursed')) DEFAULT 'not_required',
  approval_status text NOT NULL CHECK (approval_status IN ('draft','submitted','approved','rejected','locked')) DEFAULT 'draft',
  receipt_id text,
  ocr_data jsonb,
  ocr_confidence numeric(5,2),
  is_backfilled boolean NOT NULL DEFAULT false,
  period_year smallint NOT NULL,
  period_month smallint NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_company ON public.expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_vendor ON public.expenses(vendor_id);
CREATE INDEX IF NOT EXISTS idx_expenses_account ON public.expenses(account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_period ON public.expenses(company_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_expenses_backfilled ON public.expenses(is_backfilled);
CREATE INDEX IF NOT EXISTS idx_expenses_approval_status ON public.expenses(approval_status);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_company_id_expenses') THEN
    CREATE TRIGGER set_company_id_expenses
    BEFORE INSERT ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();
  END IF;
END $$;

-- Reimbursement batches
CREATE TABLE IF NOT EXISTS public.reimbursement_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT,
  employee_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('draft','submitted','approved','paid','cancelled')) DEFAULT 'draft',
  total_amount numeric NOT NULL DEFAULT 0,
  payment_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  paid_at timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reimbursement_batches_company ON public.reimbursement_batches(company_id);
CREATE INDEX IF NOT EXISTS idx_reimbursement_batches_status ON public.reimbursement_batches(status);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_company_id_reimbursement_batches') THEN
    CREATE TRIGGER set_company_id_reimbursement_batches
    BEFORE INSERT ON public.reimbursement_batches
    FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();
  END IF;
END $$;

-- Reimbursement items (link expenses to batch/payment)
CREATE TABLE IF NOT EXISTS public.reimbursement_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT,
  batch_id uuid REFERENCES public.reimbursement_batches(id) ON DELETE SET NULL,
  expense_id uuid REFERENCES public.expenses(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','included','partial','paid','cancelled')) DEFAULT 'pending',
  paid_amount numeric NOT NULL DEFAULT 0,
  payment_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  payment_reference text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reimbursement_items_company ON public.reimbursement_items(company_id);
CREATE INDEX IF NOT EXISTS idx_reimbursement_items_expense ON public.reimbursement_items(expense_id);
CREATE INDEX IF NOT EXISTS idx_reimbursement_items_batch ON public.reimbursement_items(batch_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_company_id_reimbursement_items') THEN
    CREATE TRIGGER set_company_id_reimbursement_items
    BEFORE INSERT ON public.reimbursement_items
    FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();
  END IF;
END $$;

-- Account transfers (including petty cash replenishment)
CREATE TABLE IF NOT EXISTS public.account_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT,
  from_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  to_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_transfers_company ON public.account_transfers(company_id);
CREATE INDEX IF NOT EXISTS idx_account_transfers_from ON public.account_transfers(from_account_id);
CREATE INDEX IF NOT EXISTS idx_account_transfers_to ON public.account_transfers(to_account_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_company_id_account_transfers') THEN
    CREATE TRIGGER set_company_id_account_transfers
    BEFORE INSERT ON public.account_transfers
    FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();
  END IF;
END $$;

-- Petty cash reconciliation
CREATE TABLE IF NOT EXISTS public.petty_cash_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  period_year smallint NOT NULL,
  period_month smallint NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  counted_balance numeric NOT NULL DEFAULT 0,
  book_balance numeric NOT NULL DEFAULT 0,
  variance_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('draft','submitted','locked')) DEFAULT 'draft',
  notes text,
  locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  locked_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_petty_cash_recon_company_period ON public.petty_cash_reconciliations(company_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_petty_cash_recon_status ON public.petty_cash_reconciliations(status);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_company_id_petty_cash_reconciliations') THEN
    CREATE TRIGGER set_company_id_petty_cash_reconciliations
    BEFORE INSERT ON public.petty_cash_reconciliations
    FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reimbursement_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reimbursement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petty_cash_reconciliations ENABLE ROW LEVEL SECURITY;

-- Policies: company scoping via company_users and role-based CRUD

-- Vendors
DROP POLICY IF EXISTS "company select vendors" ON public.vendors;
CREATE POLICY "company select vendors"
  ON public.vendors FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = vendors.company_id AND cu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "company insert vendors" ON public.vendors;
CREATE POLICY "company insert vendors"
  ON public.vendors FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = vendors.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company update vendors" ON public.vendors;
CREATE POLICY "company update vendors"
  ON public.vendors FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = vendors.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = vendors.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company delete vendors" ON public.vendors;
CREATE POLICY "company delete vendors"
  ON public.vendors FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = vendors.company_id AND cu.user_id = auth.uid() AND cu.role = 'admin'
  ));

-- Accounts
DROP POLICY IF EXISTS "company select accounts" ON public.accounts;
CREATE POLICY "company select accounts"
  ON public.accounts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = accounts.company_id AND cu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "company insert accounts" ON public.accounts;
CREATE POLICY "company insert accounts"
  ON public.accounts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = accounts.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company update accounts" ON public.accounts;
CREATE POLICY "company update accounts"
  ON public.accounts FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = accounts.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = accounts.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company delete accounts" ON public.accounts;
CREATE POLICY "company delete accounts"
  ON public.accounts FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = accounts.company_id AND cu.user_id = auth.uid() AND cu.role = 'admin'
  ));

-- Expenses
DROP POLICY IF EXISTS "company select expenses" ON public.expenses;
CREATE POLICY "company select expenses"
  ON public.expenses FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = expenses.company_id AND cu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "company insert expenses" ON public.expenses;
CREATE POLICY "company insert expenses"
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = expenses.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager','sales')
  ));

DROP POLICY IF EXISTS "company update expenses" ON public.expenses;
CREATE POLICY "company update expenses"
  ON public.expenses FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = expenses.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = expenses.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company delete expenses" ON public.expenses;
CREATE POLICY "company delete expenses"
  ON public.expenses FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = expenses.company_id AND cu.user_id = auth.uid() AND cu.role = 'admin'
  ));

-- Accounting periods
DROP POLICY IF EXISTS "company select accounting_periods" ON public.accounting_periods;
CREATE POLICY "company select accounting_periods"
  ON public.accounting_periods FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = accounting_periods.company_id AND cu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "company insert accounting_periods" ON public.accounting_periods;
CREATE POLICY "company insert accounting_periods"
  ON public.accounting_periods FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = accounting_periods.company_id AND cu.user_id = auth.uid() AND cu.role = 'admin'
  ));

DROP POLICY IF EXISTS "company update accounting_periods" ON public.accounting_periods;
CREATE POLICY "company update accounting_periods"
  ON public.accounting_periods FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = accounting_periods.company_id AND cu.user_id = auth.uid() AND cu.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = accounting_periods.company_id AND cu.user_id = auth.uid() AND cu.role = 'admin'
  ));

DROP POLICY IF EXISTS "company delete accounting_periods" ON public.accounting_periods;
CREATE POLICY "company delete accounting_periods"
  ON public.accounting_periods FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = accounting_periods.company_id AND cu.user_id = auth.uid() AND cu.role = 'admin'
  ));

-- Reimbursement batches
DROP POLICY IF EXISTS "company select reimbursement_batches" ON public.reimbursement_batches;
CREATE POLICY "company select reimbursement_batches"
  ON public.reimbursement_batches FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = reimbursement_batches.company_id AND cu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "company insert reimbursement_batches" ON public.reimbursement_batches;
CREATE POLICY "company insert reimbursement_batches"
  ON public.reimbursement_batches FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = reimbursement_batches.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company update reimbursement_batches" ON public.reimbursement_batches;
CREATE POLICY "company update reimbursement_batches"
  ON public.reimbursement_batches FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = reimbursement_batches.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = reimbursement_batches.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company delete reimbursement_batches" ON public.reimbursement_batches;
CREATE POLICY "company delete reimbursement_batches"
  ON public.reimbursement_batches FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = reimbursement_batches.company_id AND cu.user_id = auth.uid() AND cu.role = 'admin'
  ));

-- Reimbursement items
DROP POLICY IF EXISTS "company select reimbursement_items" ON public.reimbursement_items;
CREATE POLICY "company select reimbursement_items"
  ON public.reimbursement_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = reimbursement_items.company_id AND cu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "company insert reimbursement_items" ON public.reimbursement_items;
CREATE POLICY "company insert reimbursement_items"
  ON public.reimbursement_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = reimbursement_items.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company update reimbursement_items" ON public.reimbursement_items;
CREATE POLICY "company update reimbursement_items"
  ON public.reimbursement_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = reimbursement_items.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = reimbursement_items.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company delete reimbursement_items" ON public.reimbursement_items;
CREATE POLICY "company delete reimbursement_items"
  ON public.reimbursement_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = reimbursement_items.company_id AND cu.user_id = auth.uid() AND cu.role = 'admin'
  ));

-- Account transfers
DROP POLICY IF EXISTS "company select account_transfers" ON public.account_transfers;
CREATE POLICY "company select account_transfers"
  ON public.account_transfers FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = account_transfers.company_id AND cu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "company insert account_transfers" ON public.account_transfers;
CREATE POLICY "company insert account_transfers"
  ON public.account_transfers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = account_transfers.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company update account_transfers" ON public.account_transfers;
CREATE POLICY "company update account_transfers"
  ON public.account_transfers FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = account_transfers.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = account_transfers.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company delete account_transfers" ON public.account_transfers;
CREATE POLICY "company delete account_transfers"
  ON public.account_transfers FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = account_transfers.company_id AND cu.user_id = auth.uid() AND cu.role = 'admin'
  ));

-- Petty cash reconciliations
DROP POLICY IF EXISTS "company select petty_cash_reconciliations" ON public.petty_cash_reconciliations;
CREATE POLICY "company select petty_cash_reconciliations"
  ON public.petty_cash_reconciliations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = petty_cash_reconciliations.company_id AND cu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "company insert petty_cash_reconciliations" ON public.petty_cash_reconciliations;
CREATE POLICY "company insert petty_cash_reconciliations"
  ON public.petty_cash_reconciliations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = petty_cash_reconciliations.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company update petty_cash_reconciliations" ON public.petty_cash_reconciliations;
CREATE POLICY "company update petty_cash_reconciliations"
  ON public.petty_cash_reconciliations FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = petty_cash_reconciliations.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = petty_cash_reconciliations.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company delete petty_cash_reconciliations" ON public.petty_cash_reconciliations;
CREATE POLICY "company delete petty_cash_reconciliations"
  ON public.petty_cash_reconciliations FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = petty_cash_reconciliations.company_id AND cu.user_id = auth.uid() AND cu.role = 'admin'
  ));
