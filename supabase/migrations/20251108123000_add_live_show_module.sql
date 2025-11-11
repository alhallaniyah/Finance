/*
  # Add Live Show POS Module Tables

  - Creates `public.live_shows`, `public.live_show_quotations`, `public.live_show_payments`
  - Adds company_id scoping and RLS policies aligned with company_users
  - Auto-populates company_id via tg_set_company_id trigger
*/

-- Ensure UUID generation is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Live Shows table
CREATE TABLE IF NOT EXISTS public.live_shows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT,
  client_id uuid REFERENCES public.clients(id) ON DELETE RESTRICT,
  show_number text NOT NULL,
  location text,
  show_date date,
  show_time text,
  item_name text,
  kg numeric,
  people_count int,
  notes text,
  status text NOT NULL CHECK (status IN ('quotation','advanced_paid','fully_paid','cancelled')) DEFAULT 'quotation',
  calendar_event_id text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_shows_company ON public.live_shows(company_id);
CREATE INDEX IF NOT EXISTS idx_live_shows_client ON public.live_shows(client_id);
CREATE INDEX IF NOT EXISTS idx_live_shows_status ON public.live_shows(status);
CREATE INDEX IF NOT EXISTS idx_live_shows_created_at ON public.live_shows(created_at);

-- Auto-populate company_id on insert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_company_id_live_shows'
  ) THEN
    CREATE TRIGGER set_company_id_live_shows
    BEFORE INSERT ON public.live_shows
    FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();
  END IF;
END $$;

-- Live Show Quotations table
CREATE TABLE IF NOT EXISTS public.live_show_quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT,
  live_show_id uuid REFERENCES public.live_shows(id) ON DELETE CASCADE,
  quotation_number text NOT NULL,
  total_estimated numeric,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_show_quotations_company ON public.live_show_quotations(company_id);
CREATE INDEX IF NOT EXISTS idx_live_show_quotations_live_show ON public.live_show_quotations(live_show_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_company_id_live_show_quotations'
  ) THEN
    CREATE TRIGGER set_company_id_live_show_quotations
    BEFORE INSERT ON public.live_show_quotations
    FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();
  END IF;
END $$;

-- Live Show Payments table
CREATE TABLE IF NOT EXISTS public.live_show_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT,
  live_show_id uuid REFERENCES public.live_shows(id) ON DELETE CASCADE,
  quotation_id uuid REFERENCES public.live_show_quotations(id) ON DELETE SET NULL,
  payment_type text NOT NULL CHECK (payment_type IN ('advance','full')),
  amount numeric NOT NULL,
  method text NOT NULL CHECK (method IN ('cash','transfer')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_show_payments_company ON public.live_show_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_live_show_payments_live_show ON public.live_show_payments(live_show_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_company_id_live_show_payments'
  ) THEN
    CREATE TRIGGER set_company_id_live_show_payments
    BEFORE INSERT ON public.live_show_payments
    FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.live_shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_show_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_show_payments ENABLE ROW LEVEL SECURITY;

-- Policies: company scoping via company_users and role-based CRUD

-- live_shows
DROP POLICY IF EXISTS "company select live_shows" ON public.live_shows;
CREATE POLICY "company select live_shows"
  ON public.live_shows FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = live_shows.company_id AND cu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "company insert live_shows" ON public.live_shows;
CREATE POLICY "company insert live_shows"
  ON public.live_shows FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = live_shows.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager','sales')
  ));

DROP POLICY IF EXISTS "company update live_shows" ON public.live_shows;
CREATE POLICY "company update live_shows"
  ON public.live_shows FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = live_shows.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager','sales')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = live_shows.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager','sales')
  ));

DROP POLICY IF EXISTS "company delete live_shows" ON public.live_shows;
CREATE POLICY "company delete live_shows"
  ON public.live_shows FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = live_shows.company_id AND cu.user_id = auth.uid() AND cu.role = 'admin'
  ));

-- live_show_quotations
DROP POLICY IF EXISTS "company select live_show_quotations" ON public.live_show_quotations;
CREATE POLICY "company select live_show_quotations"
  ON public.live_show_quotations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = live_show_quotations.company_id AND cu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "company insert live_show_quotations" ON public.live_show_quotations;
CREATE POLICY "company insert live_show_quotations"
  ON public.live_show_quotations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = live_show_quotations.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager','sales')
  ));

DROP POLICY IF EXISTS "company update live_show_quotations" ON public.live_show_quotations;
CREATE POLICY "company update live_show_quotations"
  ON public.live_show_quotations FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = live_show_quotations.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = live_show_quotations.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company delete live_show_quotations" ON public.live_show_quotations;
CREATE POLICY "company delete live_show_quotations"
  ON public.live_show_quotations FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = live_show_quotations.company_id AND cu.user_id = auth.uid() AND cu.role = 'admin'
  ));

-- live_show_payments
DROP POLICY IF EXISTS "company select live_show_payments" ON public.live_show_payments;
CREATE POLICY "company select live_show_payments"
  ON public.live_show_payments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = live_show_payments.company_id AND cu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "company insert live_show_payments" ON public.live_show_payments;
CREATE POLICY "company insert live_show_payments"
  ON public.live_show_payments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = live_show_payments.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager','sales')
  ));

DROP POLICY IF EXISTS "company update live_show_payments" ON public.live_show_payments;
CREATE POLICY "company update live_show_payments"
  ON public.live_show_payments FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = live_show_payments.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = live_show_payments.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company delete live_show_payments" ON public.live_show_payments;
CREATE POLICY "company delete live_show_payments"
  ON public.live_show_payments FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = live_show_payments.company_id AND cu.user_id = auth.uid() AND cu.role = 'admin'
  ));