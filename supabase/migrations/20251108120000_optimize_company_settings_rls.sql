-- Optimize RLS evaluation on public.company_settings by wrapping auth.uid() in
-- a scalar subquery so it is evaluated once per statement instead of per row.
-- See Supabase docs: use (select auth.uid()) or (select current_setting(...)) in policies.

-- SELECT policy
DROP POLICY IF EXISTS "company select company_settings" ON public.company_settings;
CREATE POLICY "company select company_settings"
  ON public.company_settings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = company_settings.company_id
        AND cu.user_id = (select auth.uid())
    )
  );

-- INSERT (upsert) policy
DROP POLICY IF EXISTS "company upsert company_settings" ON public.company_settings;
CREATE POLICY "company upsert company_settings"
  ON public.company_settings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = company_settings.company_id
        AND cu.user_id = (select auth.uid())
        AND cu.role IN ('admin','manager')
    )
  );

-- UPDATE policy
DROP POLICY IF EXISTS "company update company_settings" ON public.company_settings;
CREATE POLICY "company update company_settings"
  ON public.company_settings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = company_settings.company_id
        AND cu.user_id = (select auth.uid())
        AND cu.role IN ('admin','manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = company_settings.company_id
        AND cu.user_id = (select auth.uid())
        AND cu.role IN ('admin','manager')
    )
  );

-- Note: If you use current_setting('request.jwt.claims', true) or other auth.*
-- functions elsewhere, apply the same pattern: wrap in (select ... ).