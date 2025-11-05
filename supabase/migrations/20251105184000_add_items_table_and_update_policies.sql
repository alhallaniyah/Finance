/*
  # Add catalog items and adjust document delete policy

  - Creates `public.items` table scoped by `company_id`
  - Adds RLS policies with admin/manager write access
  - Reuses tg_set_company_id to auto-populate company_id
  - Updates documents delete policy to allow managers to delete
*/

-- Ensure UUID generation is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Items table
CREATE TABLE IF NOT EXISTS public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  sku text,
  price numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_items_company ON public.items(company_id);
CREATE INDEX IF NOT EXISTS idx_items_name ON public.items(name);

-- Auto-populate company_id on insert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_company_id_items'
  ) THEN
    CREATE TRIGGER set_company_id_items
    BEFORE INSERT ON public.items
    FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- Items policies
DROP POLICY IF EXISTS "company select items" ON public.items;
CREATE POLICY "company select items"
  ON public.items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = items.company_id AND cu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "company insert items" ON public.items;
CREATE POLICY "company insert items"
  ON public.items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = items.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company update items" ON public.items;
CREATE POLICY "company update items"
  ON public.items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = items.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = items.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company delete items" ON public.items;
CREATE POLICY "company delete items"
  ON public.items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = items.company_id AND cu.user_id = auth.uid() AND cu.role = 'admin'
  ));

-- Update documents delete policy to include managers
DROP POLICY IF EXISTS "company delete documents" ON public.documents;
CREATE POLICY "company delete documents"
  ON public.documents FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = documents.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));