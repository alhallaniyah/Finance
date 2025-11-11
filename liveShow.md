Live Show POS Module — Product Requirements Document

Overview
The Live Show POS Module introduces a new operational mode to the existing POS system.
It allows employees to record and manage live show bookings — halwa cooking events held at customer locations.

Unlike regular sales (in-store or delivery), live shows follow a multi-stage flow:
1. Quotation
2. Advance payment
3. Full payment
4. Completion

Each live show links to an existing record in the clients table and syncs automatically with Google Calendar for visibility.

Objectives
- Allow any employee to create and manage live show records.
- Centralize client data using the shared clients table.
- Automate quotation and receipt generation.
- Provide clear tracking of payments and completion.
- Maintain Google Calendar synchronization for scheduled events.

User Roles
- Employee: Can create, edit, and complete live shows, generate quotations, and record payments.
- Manager/Admin: Can view all live shows, override status, and access analytics dashboards.
(All employees can create live shows.)

Functional Requirements
1. Live Show Creation
   - Accessible in the POS mode selector: [In-Store] [Delivery] [Live Show]
   - Required fields: client selection, date/time, item, kg, people, location, notes.
   - Status defaults to 'quotation'.
   - Auto show_number generated (e.g. LS-2025-120458).

2. Quotation Generation
   - Creates record in live_show_quotations.
   - Generates quotation PDF (client info, event details, estimated total).
   - Creates yellow (tentative) calendar event.

3. Advance Payment
   - Mark as 'Advanced Paid'.
   - Inputs: amount, method (cash or transfer).
   - Creates live_show_payments record, updates status, generates receipt, calendar turns blue (booked).

4. Full Payment / Completion
   - Mark as 'Fully Paid'.
   - Inputs: amount, method (cash or transfer).
   - Adds payment record, updates status, generates final receipt, calendar turns green (completed).

5. Cancellation
   - Marks show as cancelled.
   - Calendar turns red or event deleted.
   - History retained for audit.

6. Viewing Progress
   - Shows client info, quotation, payments, receipts, calendar link, and status timeline.

Database Schema
clients
  id uuid primary key,
  name text not null,
  phone text,
  address text,
  emirate text,
  created_at timestamptz default now()

live_shows
  id uuid primary key,
  client_id uuid references clients(id) on delete restrict,
  show_number generated (LS-YYYY-XXXXXX),
  location text,
  show_date date,
  show_time text,
  item_name text,
  kg numeric,
  people_count int,
  notes text,
  status text check (quotation|advanced_paid|fully_paid|cancelled),
  calendar_event_id text,
  created_at timestamptz default now()

live_show_quotations
  id uuid primary key,
  live_show_id uuid references live_shows(id) on delete cascade,
  quotation_number text,
  total_estimated numeric,
  created_by uuid,
  created_at timestamptz default now()

live_show_payments
  id uuid primary key,
  live_show_id uuid references live_shows(id) on delete cascade,
  quotation_id uuid references live_show_quotations(id),
  payment_type text check (advance|full),
  amount numeric not null,
  method text check (cash|transfer) not null,
  created_by uuid,
  created_at timestamptz default now()

Google Calendar Integration
- Quotation: yellow (tentative)
- Advanced paid: blue (booked)
- Fully paid: green (completed)
- Cancelled: red or deleted

Receipts & Documents
- Quotation: generated PDF, not a tax invoice.
- Advance Receipt: amount paid, remaining balance, payment method.
- Final Receipt: combined total, marked Completed.

Permissions & Security
- Any employee can create/update live shows.
- Managers/Admins can audit and view analytics.
- Calendar credentials stored securely server-side.

Analytics / Reporting
- Live shows per month.
- KG by item.
- Cash vs Transfer totals.
- Advance vs Full totals.
- Client history via client_id.

Status Flow
[Quotation] → (Advance Paid) → [Advanced Paid] → (Full Paid) → [Fully Paid] → (or Cancelled)

Deliverables
- Database: 4 tables
- Backend: CRUD + receipts + calendar sync
- Frontend: Live Show tab, details, workflow buttons
- Documents: Quotation, Advance Receipt, Final Receipt
- Calendar: Auto color sync

Future Enhancements
- Assign employees to shows.
- Ingredient tracking.
- Client notifications.
- Integration with production planning.
