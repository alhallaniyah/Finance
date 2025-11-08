/*
  Kitchen Stopwatch Module: tables and RLS
*/

-- kitchen_batches
CREATE TABLE IF NOT EXISTS public.kitchen_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  halwa_type text NOT NULL,
  starch_weight numeric NOT NULL,
  chef_id uuid NOT NULL,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  total_duration numeric,
  status text NOT NULL DEFAULT 'in_progress', -- in_progress | completed | validated
  validation_status text, -- good | moderate | shift_detected
  validated_by uuid,
  validation_comments text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kitchen_batches_company ON public.kitchen_batches(company_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_batches_status ON public.kitchen_batches(status);

-- kitchen_process_types
CREATE TABLE IF NOT EXISTS public.kitchen_process_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  standard_duration_minutes numeric NOT NULL,
  variation_buffer_minutes numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kitchen_process_types_company ON public.kitchen_process_types(company_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_process_types_active ON public.kitchen_process_types(active);

-- kitchen_processes
CREATE TABLE IF NOT EXISTS public.kitchen_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.kitchen_batches(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  process_type_id uuid NOT NULL REFERENCES public.kitchen_process_types(id),
  start_time timestamptz,
  end_time timestamptz,
  duration_minutes numeric,
  remarks text,
  auto_recorded boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kitchen_processes_batch ON public.kitchen_processes(batch_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_processes_company ON public.kitchen_processes(company_id);

-- RLS enable
ALTER TABLE public.kitchen_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_process_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_processes ENABLE ROW LEVEL SECURITY;

-- Policies: company scoping via company_users mapping

-- kitchen_batches
DROP POLICY IF EXISTS "company select kitchen_batches" ON public.kitchen_batches;
CREATE POLICY "company select kitchen_batches"
  ON public.kitchen_batches FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = kitchen_batches.company_id AND cu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "company insert kitchen_batches" ON public.kitchen_batches;
CREATE POLICY "company insert kitchen_batches"
  ON public.kitchen_batches FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = kitchen_batches.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager','sales')
  ));

DROP POLICY IF EXISTS "company update kitchen_batches" ON public.kitchen_batches;
CREATE POLICY "company update kitchen_batches"
  ON public.kitchen_batches FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = kitchen_batches.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager','sales')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = kitchen_batches.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager','sales')
  ));

-- kitchen_process_types
DROP POLICY IF EXISTS "company select kitchen_process_types" ON public.kitchen_process_types;
CREATE POLICY "company select kitchen_process_types"
  ON public.kitchen_process_types FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = kitchen_process_types.company_id AND cu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "company insert kitchen_process_types" ON public.kitchen_process_types;
CREATE POLICY "company insert kitchen_process_types"
  ON public.kitchen_process_types FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = kitchen_process_types.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "company update kitchen_process_types" ON public.kitchen_process_types;
CREATE POLICY "company update kitchen_process_types"
  ON public.kitchen_process_types FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = kitchen_process_types.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = kitchen_process_types.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager')
  ));

-- kitchen_processes
DROP POLICY IF EXISTS "company select kitchen_processes" ON public.kitchen_processes;
CREATE POLICY "company select kitchen_processes"
  ON public.kitchen_processes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = kitchen_processes.company_id AND cu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "company insert kitchen_processes" ON public.kitchen_processes;
CREATE POLICY "company insert kitchen_processes"
  ON public.kitchen_processes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = kitchen_processes.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager','sales')
  ));

DROP POLICY IF EXISTS "company update kitchen_processes" ON public.kitchen_processes;
CREATE POLICY "company update kitchen_processes"
  ON public.kitchen_processes FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = kitchen_processes.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager','sales')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = kitchen_processes.company_id AND cu.user_id = auth.uid() AND cu.role IN ('admin','manager','sales')
  ));