/*
  # Document origin identifier

  Adds an origin column to documents so we can distinguish dashboard-generated
  invoices from POS in-store receipts and delivery receipts.
*/

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS origin text DEFAULT 'dashboard';

CREATE INDEX IF NOT EXISTS idx_documents_origin ON documents(origin);
