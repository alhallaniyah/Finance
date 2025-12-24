/*
  # Add expense categories table and link expenses to categories

  - Creates expense_categories lookup with policy/controls
  - Adds nullable category_id FK on expenses (keeps existing category text)
  - Safe, non-breaking: all columns nullable/defaulted
*/

-- Expense categories lookup
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT,
  name text NOT NULL,
  code text NOT NULL,
  parent_category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  ledger_account_code text,
  default_vat_treatment text CHECK (default_vat_treatment IN ('recoverable','non_recoverable','mixed')) DEFAULT 'recoverable',
  requires_receipt boolean NOT NULL DEFAULT false,
  requires_approval_above numeric,
  is_active boolean NOT NULL DEFAULT true,
  policy_notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expense_categories_unique_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_company ON public.expense_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_parent ON public.expense_categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_active ON public.expense_categories(is_active);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_company_id_expense_categories') THEN
    CREATE TRIGGER set_company_id_expense_categories
    BEFORE INSERT ON public.expense_categories
    FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();
  END IF;
END $$;

-- Link expenses to categories (keep legacy category text)
ALTER TABLE IF EXISTS public.expenses
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON public.expenses(category_id);

-- RLS for expense_categories
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company select expense_categories" ON public.expense_categories;
CREATE POLICY "company select expense_categories"
  ON public.expense_categories FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = expense_categories.company_id AND cu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "company insert expense_categories" ON public.expense_categories;
CREATE POLICY "company insert expense_categories"
  ON public.expense_categories FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = expense_categories.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company update expense_categories" ON public.expense_categories;
CREATE POLICY "company update expense_categories"
  ON public.expense_categories FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = expense_categories.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = expense_categories.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company delete expense_categories" ON public.expense_categories;
CREATE POLICY "company delete expense_categories"
  ON public.expense_categories FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = expense_categories.company_id AND cu.user_id = auth.uid() AND cu.role = 'admin'
  ));
