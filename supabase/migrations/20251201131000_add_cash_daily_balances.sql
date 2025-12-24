/*
  # Daily cash opening/closing per account

  - Tracks opening and closing cash per day per account
  - Non-breaking: new table only
*/

CREATE TABLE IF NOT EXISTS public.cash_daily_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  opening_amount numeric NOT NULL DEFAULT 0,
  closing_amount numeric,
  difference numeric,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cash_daily_balances_unique UNIQUE (company_id, account_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_cash_daily_balances_company_date ON public.cash_daily_balances(company_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_cash_daily_balances_account ON public.cash_daily_balances(account_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_company_id_cash_daily_balances') THEN
    CREATE TRIGGER set_company_id_cash_daily_balances
    BEFORE INSERT ON public.cash_daily_balances
    FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();
  END IF;
END $$;

-- RLS
ALTER TABLE public.cash_daily_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company select cash_daily_balances" ON public.cash_daily_balances;
CREATE POLICY "company select cash_daily_balances"
  ON public.cash_daily_balances FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = cash_daily_balances.company_id AND cu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "company insert cash_daily_balances" ON public.cash_daily_balances;
CREATE POLICY "company insert cash_daily_balances"
  ON public.cash_daily_balances FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = cash_daily_balances.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company update cash_daily_balances" ON public.cash_daily_balances;
CREATE POLICY "company update cash_daily_balances"
  ON public.cash_daily_balances FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = cash_daily_balances.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = cash_daily_balances.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company delete cash_daily_balances" ON public.cash_daily_balances;
CREATE POLICY "company delete cash_daily_balances"
  ON public.cash_daily_balances FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu WHERE cu.company_id = cash_daily_balances.company_id AND cu.user_id = auth.uid() AND cu.role = 'admin'
  ));
