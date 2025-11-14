-- Add price_multiplier column to delivery_providers for server-backed pricing
-- Allows storing a provider-wide price multiplier (e.g., 1.10 for +10%)

BEGIN;

-- Add column as numeric with reasonable precision/scale; nullable by default
ALTER TABLE public.delivery_providers
  ADD COLUMN IF NOT EXISTS price_multiplier NUMERIC(10,4);

-- Optional: ensure existing rows have NULL (implicit)
UPDATE public.delivery_providers SET price_multiplier = NULL WHERE price_multiplier IS NULL;

COMMENT ON COLUMN public.delivery_providers.price_multiplier IS 'Provider-wide price multiplier used by POS';

COMMIT;