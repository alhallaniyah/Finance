# Product Definition & Requirements (PDR)

## Overview

- Application: a complete pos and staff management application
- Frontend: React + TypeScript + Vite + Tailwind
- Data: Supabase (Postgres + RLS) with typed helpers
- Services: Python Flask `receipt_api.py` for 80mm thermal receipt PDFs
- Purpose: Manage quotations, invoices, delivery notes, POS sales, printing, and simple catalog/admin without heavy ERP complexity

## Goals

- Streamlined creation and management of documents (quotation, invoice, delivery note)
- Fast dashboard browsing with caching and pagination
- POS workflows for in‑store and delivery, with payment capture and receipts
- Role‑based data safety and company scoping via Supabase RLS
- Print‑ready PDFs for desktop printers and thermal 80mm receipts

## Personas & Roles

- Admin
  - Manages company catalog (items) and delivery providers
  - Full update privileges for documents and settings
- Manager
  - Creates and updates documents; manages catalog/providers
- Sales
  - Creates documents; limited update permissions

Role resolution: mapped via `company_users` table (`getCurrentUserRole`) with RLS policies limiting select/insert/update by role and company.

## High‑Level Architecture

- Frontend
  - `App.tsx` navigates between `dashboard`, `create`, `edit`, `view`, `settings`, `pos`, `admin`
  - Key components
    - `Dashboard.tsx`: paginated 10 per page; search/filters; bulk delete; view/edit/duplicate; open Settings/POS/Admin; origin badges
    - `DocumentForm.tsx`: form for quotation/invoice/delivery note; client selection and details; items with unit/weight sell-by; payments; delivery provider/fee; auto-numbering; save & print
    - `DocumentView.tsx`: view/print document; auto-prints POS in-store via receipt API; desktop print for others; thermal stylesheet for 80mm
    - `POSMode.tsx`: fast product list, cart, customer/delivery inputs; creates POS orders (in-store/delivery)
    - `Admin.tsx`: CRUD for `items` and `delivery_providers`
    - `Settings.tsx`: company name/address/TRN/logo, default terms, tax rate
    - `ExcelImport.tsx`: bulk import from Excel
  - Helpers
    - `supabaseHelpers.ts`: typed access to tables; document/item/client CRUD; `createPOSOrder`; `getDocumentsCached` with 60s TTL; `getDocumentsPage(page, pageSize)`; delivery provider helpers; company settings helpers
    - `documentHelpers.ts`: number formatting, date formatting, document numbering helper
    - `src/utils/api.js`: `generateReceipt(payload)` HTTP call to Flask service

- Data & Security
  - Supabase tables: `documents`, `document_items`, `clients`, `items`, `company_settings`, `delivery_providers`, `company_users`
  - RLS policies ensure users only access records belonging to their company and within role capabilities (insert/update restrictions for admin/manager; select for authenticated company members)
  - Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

- Services
  - Flask `receipt_api.py`
    - Endpoint: `POST /api/generate-receipt` (CORS enabled)
    - Port: read from `PORT` env (use `5001` for dev). Start with `PORT=5001 python3 api/receipt_api.py`
    - Generates 80mm thermal PDF with company header, items, Subtotal, VAT, Total, Paid Amount; fixes to ensure text renders on the final canvas

## Features (Current)

- Authentication & Authorization
  - Auth wrapper ensures guarded views
  - Role detection via Supabase `company_users`

- Dashboard
  - Paginated list: 10 documents per page (`getDocumentsPage`)
  - Search by term; filter by type/status/date/origin
  - Origin badges: Dashboard, POS In‑Store, POS Delivery
  - Actions: view, edit, duplicate, delete (bulk)
  - Summary stats (counts/revenue tracking planned in README)

- Documents
  - Types: quotation, invoice, delivery note
  - Auto-numbering: per type per day (e.g., YYYYMMDD sequence)
  - Client selection or manual input; TRN, emirate, address
  - Items: unit or weight sell‑by; amounts auto‑calculated
  - Payments
    - Invoice: `cash` / `card` / `both` split
    - Delivery note: `cod` / `transfer`; delivery fee
  - Delivery provider: selection and optional managed flag
  - Terms & conditions, notes; status: draft/sent/paid/cancelled
  - Save & Print option

- POS Mode
  - In‑store sale:
    - Creates single invoice with payment method and split amounts
    - Thermal receipt via Flask service
  - Delivery sale:
    - Creates invoice + delivery note pair
    - Captures delivery provider, fee (managed providers default fee to 0)
  - Product list and cart; item sell‑by unit/weight

- Admin
  - Items: name/sku/price/sell‑by; create, update, delete
  - Delivery providers: name/phone/method/managed; create, update, delete

- Settings
  - Company name, address, TRN, logo URL
  - Default terms; tax rate

- Import/Export
  - Excel import for documents (`ExcelImport.tsx`)
  - Print/PDF export via browser and POS service

- Printing
  - Desktop print for non‑POS documents
  - Thermal 80mm PDF for POS in‑store via `generateReceipt`
  - Auto‑print support from `DocumentView` when `autoPrint` is true

- Performance & UX
  - Dashboard cache: 60s TTL for document list with invalidation on mutations
  - Server‑side pagination for 10 per page
  - Mobile‑friendly layout and touch‑optimized controls

## Data Model (Key Fields)

- Document
  - `document_type`, `document_number`, `client_*`, `issue_date`, `due_date`, `subtotal`, `tax_amount`, `discount_amount`, `total`, `status`, `notes`, `terms`
  - `origin`: `dashboard` | `pos_in_store` | `pos_delivery`
  - `payment_method`: `cash` | `card` | `both` | `cod` | `transfer`
  - `payment_card_amount`, `payment_cash_amount`
  - `delivery_fee`, `delivery_provider_id`

- DocumentItem
  - `document_id`, `description`, `quantity`, `weight`, `sell_by` (`unit` | `weight`), `unit_price`, `amount`

- Client
  - `name`, `email`, `phone`, `address`, `trn`, `emirate`

- CompanySettings
  - `company_name`, `company_address`, `company_trn`, `company_logo_url`, `default_terms`, `tax_rate`

- Item
  - `name`, `sku`, `price`, `sell_by`

- DeliveryProvider
  - `name`, `phone`, `method`, `managed`

## Business Rules

- Document numbering: per type per day; sequential numbering generated server‑side helper
- Tax calculation: based on `CompanySettings.tax_rate`; item amounts derived by `sell_by` basis (quantity or weight × unit price)
- Delivery fee: defaults to 0 for managed providers; otherwise uses entered fee
- POS delivery creates two documents: invoice and delivery note
- Cache invalidation: on `createDocument`, `updateDocument`, `deleteDocument` and related item mutations

## APIs & Integration

- Receipt API (Flask)
  - URL: `http://localhost:5001/api/generate-receipt`
  - Method: `POST`
  - Example payload
    ```json
    {
      "companyName": "Demo Co",
      "companyAddress": "Dubai, UAE",
      "companyPhone": "+971 50 000 0000",
      "receiptNo": "INV-20251107-001",
      "date": "07/11/2025",
      "paymentMethod": "cash",
      "items": [
        { "name": "Product A", "quantity": 2, "unitPrice": 10, "total": 20 }
      ],
      "subtotal": 20,
      "vat": 1,
      "total": 21,
      "paidAmount": 21
    }
    ```
  - Frontend call: `generateReceipt(payload)` in `src/utils/api.js`

## Non‑Functional Requirements

- Security: Supabase RLS; role‑based policies; company scoping
- Performance: caching + server‑side pagination
- Reliability: receipt API fallback to browser print on failure
- Compatibility: mobile‑friendly UI, thermal printing CSS for 80mm receipts

## Current Gaps & Notes

- README references Firebase; app currently uses Supabase (docs need alignment)
- Dashboard search/filters operate client‑side on the loaded page; not server‑side
- After deletions, page index may need adjusting when the last item on a page is removed
- Thermal receipt font path must exist on macOS; if missing, fallback fonts affect Unicode rendering

## Roadmap / Backlog (to add)

- Server‑side search and filters for dashboard pagination
- Page size selector (10/25/50) and persistent preference
- Enhanced analytics widgets for dashboard (revenue by period, product sales)
- Delivery note print layout aligned with provider requirements
- Role management UI and invitations
- Multi‑company support in UI (switcher)
- Item barcode scanning and quick add in POS
- Offline queue for POS saves and prints
- Stale‑while‑revalidate caching and cross‑tab persistence
- Export improvements (CSV/Excel from dashboard filters)
- Settings: logo upload to storage bucket; theme options

## Runbook (Dev)

- Frontend dev server
  - `npm run dev` → `http://localhost:5174/`

- Receipt API (Flask)
  - `PORT=5001 python3 api/receipt_api.py` → `http://127.0.0.1:5001/`
  - Ensure browser pop‑ups allowed for PDF window

## Decision Log (Recent)

- Added `getDocumentsPage` for server‑side pagination (10 per page)
- Introduced lightweight 60s TTL cache for dashboard document list
- Fixed PDF rendering by drawing text on final canvas; added Subtotal & VAT