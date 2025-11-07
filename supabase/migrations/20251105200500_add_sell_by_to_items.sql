-- Add sell_by (unit|weight) to items catalog
DO $$
BEGIN
  -- Add column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'items' AND column_name = 'sell_by'
  ) THEN
    ALTER TABLE public.items ADD COLUMN sell_by text;
  END IF;

  -- Default and not null
  ALTER TABLE public.items ALTER COLUMN sell_by SET DEFAULT 'unit';
  UPDATE public.items SET sell_by = 'unit' WHERE sell_by IS NULL;
  ALTER TABLE public.items ALTER COLUMN sell_by SET NOT NULL;

  -- Check constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'items_sell_by_check'
  ) THEN
    ALTER TABLE public.items
      ADD CONSTRAINT items_sell_by_check CHECK (sell_by IN ('unit','weight'));
  END IF;
END $$;

-- Ensure index exists for potential filtering
CREATE INDEX IF NOT EXISTS idx_items_sell_by ON public.items(sell_by);