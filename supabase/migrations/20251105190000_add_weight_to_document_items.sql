-- Add weight column to document_items
-- Default 0 to preserve existing behavior
ALTER TABLE public.document_items
ADD COLUMN IF NOT EXISTS weight numeric NOT NULL DEFAULT 0;