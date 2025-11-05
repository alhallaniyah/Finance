/*
  # Normalize and refactor database schema for multi-company, multi-user, and transactional structure

  This migration:
  - Introduces company isolation via companies and company_users (role mapping)
  - Extends documents with company_id, delivery provider references, and delivery fee
  - Adds transactions table for payments
  - Normalizes delivery providers
  - Adds RLS policies for company-based isolation and role-based CRUD
  - Seeds company/company_users for existing auth.users to preserve access

  Notes:
  - Existing user_id-based RLS policies remain; company-based policies are added.
  - Existing rows are mapped to a default company per user (company_id = auth.users.id).
  - Optional: drop deprecated payment columns from documents after migrating data (not executed here).
*/

-- Ensure UUID generation is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Companies
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trade_license text,
  trn text,
  address text,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_name ON public.companies(name);

-- 2) Company users (link to auth.users with role)
CREATE TABLE IF NOT EXISTS public.company_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin','manager','sales')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_company_users_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_company_users_company ON public.company_users(company_id);
CREATE INDEX IF NOT EXISTS idx_company_users_user ON public.company_users(user_id);

-- Seed: create a default company per auth user and map them as admin
INSERT INTO public.companies (id, name, email)
SELECT u.id, COALESCE(u.email, 'Company'), u.email
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.company_users (user_id, company_id, role)
SELECT u.id, u.id, 'admin'
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

-- 3) Delivery providers
CREATE TABLE IF NOT EXISTS public.delivery_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  method text,
  managed boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_providers_company ON public.delivery_providers(company_id);

-- 4) Transactions: payments tied to documents
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  payment_method text,
  payment_card_amount numeric,
  payment_cash_amount numeric,
  total_paid numeric GENERATED ALWAYS AS (COALESCE(payment_card_amount,0) + COALESCE(payment_cash_amount,0)) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_document ON public.transactions(document_id);

-- 5) Documents: add company association and delivery fields
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.company_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_provider_id uuid REFERENCES public.delivery_providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_fee numeric;

-- Backfill company_id using existing user_id mapping
UPDATE public.documents d
SET company_id = cu.company_id
FROM public.company_users cu
WHERE cu.user_id = d.user_id AND d.company_id IS NULL;

-- Normalize clients and company_settings by adding company_id for company isolation
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT;

UPDATE public.clients c
SET company_id = cu.company_id
FROM public.company_users cu
WHERE cu.user_id = c.user_id AND c.company_id IS NULL;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT;

UPDATE public.company_settings cs
SET company_id = cu.company_id
FROM public.company_users cu
WHERE cu.user_id = cs.user_id AND cs.company_id IS NULL;

-- Indexes to support company-based queries
CREATE INDEX IF NOT EXISTS idx_documents_company ON public.documents(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_company ON public.clients(company_id);
CREATE INDEX IF NOT EXISTS idx_company_settings_company ON public.company_settings(company_id);

-- 6) Helper function to resolve current user's company_id
CREATE OR REPLACE FUNCTION public.app_resolve_company_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT cu.company_id
  FROM public.company_users cu
  WHERE cu.user_id = auth.uid()
  LIMIT 1;
$$;

-- 7) Triggers to auto-populate company_id if missing on insert
CREATE OR REPLACE FUNCTION public.tg_set_company_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.app_resolve_company_id();
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_company_id_documents'
  ) THEN
    CREATE TRIGGER set_company_id_documents
    BEFORE INSERT ON public.documents
    FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_company_id_clients'
  ) THEN
    CREATE TRIGGER set_company_id_clients
    BEFORE INSERT ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_company_id_company_settings'
  ) THEN
    CREATE TRIGGER set_company_id_company_settings
    BEFORE INSERT ON public.company_settings
    FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_company_id_delivery_providers'
  ) THEN
    CREATE TRIGGER set_company_id_delivery_providers
    BEFORE INSERT ON public.delivery_providers
    FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();
  END IF;
END $$;

-- 8) RLS: enable and add company-based policies with role checks
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_providers ENABLE ROW LEVEL SECURITY;

-- Companies policies
DROP POLICY IF EXISTS "company members can select company" ON public.companies;
CREATE POLICY "company members can select company"
  ON public.companies FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = companies.id AND cu.user_id = auth.uid()
  ));

-- Company users policies
DROP POLICY IF EXISTS "user can select own mapping" ON public.company_users;
CREATE POLICY "user can select own mapping"
  ON public.company_users FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Documents policies (company-based)
DROP POLICY IF EXISTS "company select documents" ON public.documents;
CREATE POLICY "company select documents"
  ON public.documents FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = documents.company_id AND cu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "company insert documents" ON public.documents;
CREATE POLICY "company insert documents"
  ON public.documents FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = documents.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager','sales')
  ));

DROP POLICY IF EXISTS "company update documents" ON public.documents;
CREATE POLICY "company update documents"
  ON public.documents FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = documents.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = documents.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company delete documents" ON public.documents;
CREATE POLICY "company delete documents"
  ON public.documents FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = documents.company_id AND cu.user_id = auth.uid() AND cu.role = 'admin'
  ));

-- Document items policies (join to documents)
DROP POLICY IF EXISTS "company select document_items" ON public.document_items;
CREATE POLICY "company select document_items"
  ON public.document_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.company_users cu ON cu.company_id = d.company_id AND cu.user_id = auth.uid()
    WHERE d.id = document_items.document_id
  ));

DROP POLICY IF EXISTS "company insert document_items" ON public.document_items;
CREATE POLICY "company insert document_items"
  ON public.document_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.company_users cu ON cu.company_id = d.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager','sales')
    WHERE d.id = document_items.document_id
  ));

DROP POLICY IF EXISTS "company update document_items" ON public.document_items;
CREATE POLICY "company update document_items"
  ON public.document_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.company_users cu ON cu.company_id = d.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
    WHERE d.id = document_items.document_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.company_users cu ON cu.company_id = d.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
    WHERE d.id = document_items.document_id
  ));

DROP POLICY IF EXISTS "company delete document_items" ON public.document_items;
CREATE POLICY "company delete document_items"
  ON public.document_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.company_users cu ON cu.company_id = d.company_id AND cu.user_id = auth.uid() AND cu.role = 'admin'
    WHERE d.id = document_items.document_id
  ));

-- Clients policies
DROP POLICY IF EXISTS "company select clients" ON public.clients;
CREATE POLICY "company select clients"
  ON public.clients FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = clients.company_id AND cu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "company insert clients" ON public.clients;
CREATE POLICY "company insert clients"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = clients.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager','sales')
  ));

DROP POLICY IF EXISTS "company update clients" ON public.clients;
CREATE POLICY "company update clients"
  ON public.clients FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = clients.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = clients.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company delete clients" ON public.clients;
CREATE POLICY "company delete clients"
  ON public.clients FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = clients.company_id AND cu.user_id = auth.uid() AND cu.role = 'admin'
  ));

-- Company settings policies
DROP POLICY IF EXISTS "company select company_settings" ON public.company_settings;
CREATE POLICY "company select company_settings"
  ON public.company_settings FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = company_settings.company_id AND cu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "company upsert company_settings" ON public.company_settings;
CREATE POLICY "company upsert company_settings"
  ON public.company_settings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = company_settings.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company update company_settings" ON public.company_settings;
CREATE POLICY "company update company_settings"
  ON public.company_settings FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = company_settings.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = company_settings.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

-- Delivery providers policies
DROP POLICY IF EXISTS "company select delivery_providers" ON public.delivery_providers;
CREATE POLICY "company select delivery_providers"
  ON public.delivery_providers FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = delivery_providers.company_id AND cu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "company manage delivery_providers" ON public.delivery_providers;
CREATE POLICY "company manage delivery_providers"
  ON public.delivery_providers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = delivery_providers.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company update delivery_providers" ON public.delivery_providers;
CREATE POLICY "company update delivery_providers"
  ON public.delivery_providers FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = delivery_providers.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = delivery_providers.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company delete delivery_providers" ON public.delivery_providers;
CREATE POLICY "company delete delivery_providers"
  ON public.delivery_providers FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = delivery_providers.company_id AND cu.user_id = auth.uid() AND cu.role = 'admin'
  ));

-- Transactions policies (company-based via document)
DROP POLICY IF EXISTS "company select transactions" ON public.transactions;
CREATE POLICY "company select transactions"
  ON public.transactions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.company_users cu ON cu.company_id = d.company_id AND cu.user_id = auth.uid()
    WHERE d.id = transactions.document_id
  ));

DROP POLICY IF EXISTS "company insert transactions" ON public.transactions;
CREATE POLICY "company insert transactions"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.company_users cu ON cu.company_id = d.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager','sales')
    WHERE d.id = transactions.document_id
  ));

DROP POLICY IF EXISTS "company update transactions" ON public.transactions;
CREATE POLICY "company update transactions"
  ON public.transactions FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.company_users cu ON cu.company_id = d.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
    WHERE d.id = transactions.document_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.company_users cu ON cu.company_id = d.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
    WHERE d.id = transactions.document_id
  ));

DROP POLICY IF EXISTS "company delete transactions" ON public.transactions;
CREATE POLICY "company delete transactions"
  ON public.transactions FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.company_users cu ON cu.company_id = d.company_id AND cu.user_id = auth.uid() AND cu.role = 'admin'
    WHERE d.id = transactions.document_id
  ));

-- Optional: migrate existing payment columns from documents into transactions, then drop columns
-- (Uncomment and adapt if your documents table currently includes payment fields)
-- INSERT INTO public.transactions (document_id, payment_method, payment_card_amount, payment_cash_amount)
-- SELECT id, payment_method, payment_card_amount, payment_cash_amount FROM public.documents;
-- ALTER TABLE public.documents DROP COLUMN IF EXISTS payment_method;
-- ALTER TABLE public.documents DROP COLUMN IF EXISTS payment_card_amount;
-- ALTER TABLE public.documents DROP COLUMN IF EXISTS payment_cash_amount;
