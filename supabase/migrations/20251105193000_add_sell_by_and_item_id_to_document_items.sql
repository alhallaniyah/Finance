-- Add sell_by (unit|weight) and item_id reference to document_items
DO $$
BEGIN
  -- sell_by column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_items' AND column_name = 'sell_by'
  ) THEN
    ALTER TABLE public.document_items ADD COLUMN sell_by text;
  END IF;

  -- Default and not null
  ALTER TABLE public.document_items ALTER COLUMN sell_by SET DEFAULT 'unit';
  UPDATE public.document_items SET sell_by = 'unit' WHERE sell_by IS NULL;
  ALTER TABLE public.document_items ALTER COLUMN sell_by SET NOT NULL;

  -- Add check constraint if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_items_sell_by_check'
  ) THEN
    ALTER TABLE public.document_items
      ADD CONSTRAINT document_items_sell_by_check CHECK (sell_by IN ('unit','weight'));
  END IF;

  -- item_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_items' AND column_name = 'item_id'
  ) THEN
    ALTER TABLE public.document_items ADD COLUMN item_id uuid;
  END IF;

  -- optional FK to items(id) if table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'items'
  ) THEN
    -- Add constraint only if not exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'document_items_item_id_fkey'
    ) THEN
      ALTER TABLE public.document_items
        ADD CONSTRAINT document_items_item_id_fkey
        FOREIGN KEY (item_id)
        REFERENCES public.items(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;