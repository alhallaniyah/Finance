-- Consolidate multiple permissive SELECT policies on public.document_items
-- into a single policy for better performance, and wrap auth.uid() with a
-- scalar subquery to avoid per-row evaluation.

-- Drop legacy/select policies that overlap
DROP POLICY IF EXISTS "Users can view own document items" ON public.document_items;
DROP POLICY IF EXISTS "Users can view own document items" ON document_items;
DROP POLICY IF EXISTS "company select document_items" ON public.document_items;
DROP POLICY IF EXISTS "document_items_select_own" ON public.document_items;
DROP POLICY IF EXISTS "document_items_select_own" ON document_items;

-- Create single permissive SELECT policy combining owner and company membership
CREATE POLICY "document_items select combined"
  ON public.document_items FOR SELECT TO authenticated
  USING (
    (document_items.user_id = (select auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.company_users cu
        ON cu.company_id = d.company_id
       AND cu.user_id = (select auth.uid())
      WHERE d.id = document_items.document_id
    )
  );