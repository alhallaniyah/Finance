-- Create delivery_provider_overrides table to store per-item provider pricing

BEGIN;

CREATE TABLE IF NOT EXISTS public.delivery_provider_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  provider_id uuid NOT NULL,
  item_id uuid NOT NULL,
  sku text,
  price numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint to support upsert semantics per company+provider+item
CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_provider_overrides_unique
  ON public.delivery_provider_overrides (company_id, provider_id, item_id);

-- Helpful indexes for common queries
CREATE INDEX IF NOT EXISTS idx_delivery_provider_overrides_provider
  ON public.delivery_provider_overrides (provider_id);

-- Enable RLS and define company-scoped policies similar to existing tables
ALTER TABLE public.delivery_provider_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company select delivery_provider_overrides" ON public.delivery_provider_overrides;
CREATE POLICY "company select delivery_provider_overrides"
  ON public.delivery_provider_overrides FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = delivery_provider_overrides.company_id
      AND cu.user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "company insert delivery_provider_overrides" ON public.delivery_provider_overrides;
CREATE POLICY "company insert delivery_provider_overrides"
  ON public.delivery_provider_overrides FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = delivery_provider_overrides.company_id
      AND cu.user_id = (select auth.uid())
      AND cu.role IN ('admin','manager','sales')
  ));

DROP POLICY IF EXISTS "company update delivery_provider_overrides" ON public.delivery_provider_overrides;
CREATE POLICY "company update delivery_provider_overrides"
  ON public.delivery_provider_overrides FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = delivery_provider_overrides.company_id
      AND cu.user_id = (select auth.uid())
      AND cu.role IN ('admin','manager','sales')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = delivery_provider_overrides.company_id
      AND cu.user_id = (select auth.uid())
      AND cu.role IN ('admin','manager','sales')
  ));

DROP POLICY IF EXISTS "company delete delivery_provider_overrides" ON public.delivery_provider_overrides;
CREATE POLICY "company delete delivery_provider_overrides"
  ON public.delivery_provider_overrides FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = delivery_provider_overrides.company_id
      AND cu.user_id = (select auth.uid())
      AND cu.role IN ('admin','manager','sales')
  ));

COMMIT;