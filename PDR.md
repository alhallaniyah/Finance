# Product Definition & Requirements (PDR)

## Overview

- Application: a complete pos and staff management application
- Frontend: React + TypeScript + Vite + Tailwind
- Data: Supabase (Postgres + RLS) with typed helpers
- Services: Python Flask `receipt_api.py` for 80mm thermal receipt PDFs
- Purpose: Manage quotations, invoices, delivery notes, POS sales, Live Show bookings and payments, Kitchen production tracking, printing, and simple catalog/admin without heavy ERP complexity

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

- Live Show POS Module
  - Creation
    - Capture client, date, time, item, kg, people, location, notes
    - Auto `show_number` (e.g., `LS-YYYYMMDDXXXXXX`)
    - Status defaults to `quotation`
  - Quotation Generation
    - Creates `live_show_quotations` row with `total_estimated`
    - Generates a quotation document (non‑tax invoice)
    - Calendar event created with yellow (tentative)
  - Advance Payment
    - From POS or All Live Shows, record an advance payment with `amount`, `method` (`cash` | `transfer`), and selected Payment Date
    - Inserts `live_show_payments` with `payment_type='advance'`
    - Updates the payment’s `created_at` to the selected Payment Date for audit consistency (allowed for admin/manager per RLS)
    - Creates an invoice‑style receipt using `issue_date` = selected Payment Date; includes payment method and tax
    - Updates Live Show status to `advanced_paid`; calendar turns blue (booked)
  - Full Payment / Completion
    - Record final payment with `amount`, `method`; inserts `payment_type='full'`
    - Creates final receipt; status moves to `fully_paid`; calendar turns green (completed)
  - All Live Shows Page
    - Paginated table of all shows with inline actions: Edit, Delete, Record Advance
    - Record Advance modal fields: Amount, Payment Date (reflected on receipt `issue_date`), Payment Method
    - Save & Print flow: records payment, aligns `created_at`, generates receipt, opens print view
  - Detail Page
    - Shows client, quotations, payments, totals (estimated/advance/full/balance)
    - Inline edit of payment date available for admin/manager
  - Receipts
    - Notes include show context: number, item, people, location, date, time
    - Single line item: `Advance Payment (ls-XXXXXX)` for the paid amount; tax applied from settings
  - RLS & Permissions
    - Any employee can create live shows and record payments
    - Admin/Manager can update payment dates (edit `created_at`)

- Calendar Integration
  - Live Show events are color‑coded:
    - Quotation: yellow (tentative)
    - Advanced paid: blue (booked)
    - Fully paid: green (completed)
    - Cancelled: red or deleted
  - Calendar entries store `calendar_event_id` for sync

- Kitchen Production & Stopwatch Module
  - Batches
    - Create kitchen batches with halwa type and starch weight
    - Track start/end times, durations, and status (`in_progress` | `completed` | `validated`)
  - Process Types & Maps
    - Define process types with standard durations and variation buffers
    - Map processes to halwa types with sequence orders
  - Processes
    - Precreate processes for a batch; start/stop individual processes
    - Auto recording flag and remarks supported
  - Validation
    - Validate batches with `validation_status` (`good` | `moderate` | `shift_detected`)
    - Admin Kitchen Dashboard provides oversight
  - Roles
    - Employees run batches; Admins/Managers can validate and view analytics

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
  - `name`, `phone`, `method`, `managed`, `price_multiplier`

- DeliveryProviderOverride
  - `company_id`, `provider_id`, `item_id`, `sku`, `price`, `created_at`

- Live Shows
  - `live_shows`
    - `id`, `company_id`, `client_id`, `show_number`, `location`, `show_date`, `show_time`, `item_name`, `kg`, `people_count`, `notes`, `status`, `calendar_event_id`, `created_by`, `created_at`
  - `live_show_quotations`
    - `id`, `company_id`, `live_show_id`, `quotation_number`, `total_estimated`, `created_by`, `created_at`
  - `live_show_payments`
    - `id`, `company_id`, `live_show_id`, `quotation_id`, `payment_type` (`advance` | `full`), `amount`, `method` (`cash` | `transfer`), `created_by`, `created_at`

- Kitchen
  - `kitchen_batches`
    - `id`, `company_id`, `halwa_type`, `starch_weight`, `chef_id`, `chef_name`, `start_time`, `end_time`, `total_duration`, `status`, `validation_status`, `validated_by`, `validation_comments`, `created_by`, `created_at`
  - `kitchen_process_types`
    - `id`, `company_id`, `name`, `standard_duration_minutes`, `variation_buffer_minutes`, `active`, `created_by`, `created_at`
  - `halwa_types`
    - `id`, `company_id`, `name`, `base_process_count`, `active`, `created_by`, `created_at`
  - `halwa_process_map`
    - `id`, `halwa_type_id`, `process_type_id`, `sequence_order`, `additional_processes`, `created_by`, `created_at`
  - `kitchen_processes`
    - `id`, `batch_id`, `company_id`, `process_type_id`, `start_time`, `end_time`, `duration_minutes`, `remarks`, `auto_recorded`, `created_by`, `created_at`

## Business Rules

- Document numbering: per type per day; sequential numbering generated server‑side helper
- Tax calculation: based on `CompanySettings.tax_rate`; item amounts derived by `sell_by` basis (quantity or weight × unit price)
- Delivery fee: defaults to 0 for managed providers; otherwise uses entered fee
- POS delivery creates two documents: invoice and delivery note
- Cache invalidation: on `createDocument`, `updateDocument`, `deleteDocument` and related item mutations
- Live Show status flow: `quotation` → (advance payment) → `advanced_paid` → (full payment) → `fully_paid` → (or `cancelled`)
- Live Show receipts: created as invoices with `issue_date` equal to chosen Payment Date; payment method printed on receipt; notes include show context
- Payment date edits: only admin/manager can update `live_show_payments.created_at`
- Calendar color rules per Live Show status (yellow/blue/green/red)

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

- Calendar Sync (Live Shows)
  - Server‑side integration holds credentials; events tracked via `calendar_event_id`
  - Status transitions update event color (yellow/blue/green/red)

## Non‑Functional Requirements

- Security: Supabase RLS; role‑based policies; company scoping
- Performance: caching + server‑side pagination
- Reliability: receipt API fallback to browser print on failure
- Compatibility: mobile‑friendly UI, thermal printing CSS for 80mm receipts
- Maintainability: typed helpers for Supabase access; clear modular components for POS, Live Shows, Kitchen
- Observability: console logging for print and save flows; error messages surfaced in modals

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
  - `npm run dev` → Vite dev server (example `http://localhost:5181/`)

- Receipt API (Flask)
  - `PORT=5001 python3 api/receipt_api.py` → `http://127.0.0.1:5001/`
  - Ensure browser pop‑ups allowed for PDF window

## Decision Log (Recent)

- Added `getDocumentsPage` for server‑side pagination (10 per page)
- Introduced lightweight 60s TTL cache for dashboard document list
- Fixed PDF rendering by drawing text on final canvas; added Subtotal & VAT
- Implemented Live Show receipts: `createAdvanceReceiptForLiveShow` with tax & method
- Added Record Advance modal on All Live Shows; Save & Print flow
- Enabled payment date edit via `updateLiveShowPaymentDate` (admin/manager)
- Introduced Kitchen Stopwatch module and validation workflow