-- Optimize kitchen module RLS policies and add composite indexes
-- for better query performance in the stopwatch views.

-- Indexes to accelerate filters and sorts used by UI
CREATE INDEX IF NOT EXISTS idx_kitchen_batches_company_created_at
  ON public.kitchen_batches (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kitchen_processes_batch_created_at
  ON public.kitchen_processes (batch_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_kitchen_process_types_company_active
  ON public.kitchen_process_types (company_id, active);

-- Helpful composite index for RLS joins used across kitchen policies
CREATE INDEX IF NOT EXISTS idx_company_users_company_user
  ON public.company_users (company_id, user_id);

-- Switch RLS policies to use scalar subquery for auth.uid()
-- kitchen_batches
DROP POLICY IF EXISTS "company select kitchen_batches" ON public.kitchen_batches;
CREATE POLICY "company select kitchen_batches"
  ON public.kitchen_batches FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = kitchen_batches.company_id AND cu.user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "company insert kitchen_batches" ON public.kitchen_batches;
CREATE POLICY "company insert kitchen_batches"
  ON public.kitchen_batches FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = kitchen_batches.company_id AND cu.user_id = (select auth.uid()) AND cu.role IN ('admin','manager','sales')
  ));

DROP POLICY IF EXISTS "company update kitchen_batches" ON public.kitchen_batches;
CREATE POLICY "company update kitchen_batches"
  ON public.kitchen_batches FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = kitchen_batches.company_id AND cu.user_id = (select auth.uid()) AND cu.role IN ('admin','manager','sales')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = kitchen_batches.company_id AND cu.user_id = (select auth.uid()) AND cu.role IN ('admin','manager','sales')
  ));

-- kitchen_process_types
DROP POLICY IF EXISTS "company select kitchen_process_types" ON public.kitchen_process_types;
CREATE POLICY "company select kitchen_process_types"
  ON public.kitchen_process_types FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = kitchen_process_types.company_id AND cu.user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "company insert kitchen_process_types" ON public.kitchen_process_types;
CREATE POLICY "company insert kitchen_process_types"
  ON public.kitchen_process_types FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = kitchen_process_types.company_id AND cu.user_id = (select auth.uid()) AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company update kitchen_process_types" ON public.kitchen_process_types;
CREATE POLICY "company update kitchen_process_types"
  ON public.kitchen_process_types FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = kitchen_process_types.company_id AND cu.user_id = (select auth.uid()) AND cu.role IN ('admin','manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = kitchen_process_types.company_id AND cu.user_id = (select auth.uid()) AND cu.role IN ('admin','manager')
  ));

-- kitchen_processes
DROP POLICY IF EXISTS "company select kitchen_processes" ON public.kitchen_processes;
CREATE POLICY "company select kitchen_processes"
  ON public.kitchen_processes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = kitchen_processes.company_id AND cu.user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "company insert kitchen_processes" ON public.kitchen_processes;
CREATE POLICY "company insert kitchen_processes"
  ON public.kitchen_processes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = kitchen_processes.company_id AND cu.user_id = (select auth.uid()) AND cu.role IN ('admin','manager','sales')
  ));

DROP POLICY IF EXISTS "company update kitchen_processes" ON public.kitchen_processes;
CREATE POLICY "company update kitchen_processes"
  ON public.kitchen_processes FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = kitchen_processes.company_id AND cu.user_id = (select auth.uid()) AND cu.role IN ('admin','manager','sales')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = kitchen_processes.company_id AND cu.user_id = (select auth.uid()) AND cu.role IN ('admin','manager','sales')
  ));