Below is the **same content rewritten cleanly as Markdown (`.md`)**, structured so it can live in a repo as a spec or be fed directly to an LLM.

No fluff. Clear sections. Copy-paste ready.

---

# Expense Management Module

**Supabase-Based Accounting System (UAE)**

## Purpose

You are a senior product architect and financial systems engineer.

Design a **production-grade Expense Management Module** for a UAE-based business application using **Supabase (Postgres + Auth + RLS)**.

The business is already operating. The system must:

* Move forward cleanly from today
* Backfill expenses and sales from January
* Always reflect the true financial position of the business
* Remain audit-safe and VAT-compliant

Historical reconstruction must **never corrupt live operations**.

---

## 1. Accounting Start Strategy

Assumptions:

* Accounting start date: **1 January**
* Current month: **December**
* Historical data will be entered gradually

The system must support:

* Opening balance snapshots
* Backfilled records clearly flagged
* Live records from today onward
* Period locking once reconciled

Explain how this is enforced at the **database**, **application**, and **workflow** levels.

---

## 2. Modes of Operation

The system must support **two explicit modes**:

### 2.1 Live Operations Mode

Used for all records from today onward.

Requirements:

* Full validation
* Approval workflows enforced
* VAT rules enforced
* Normal edit/delete rules

### 2.2 Historical Backfill Mode

Used for January through the last closed month.

Requirements:

* Records flagged as `backfilled`
* Relaxed validation
* Read-only approvals
* No deletions
* Adjustments only via journal entries

Explain how these modes are implemented technically.

---

## 3. Expense Module Data Model

Design the core `expenses` table including:

* `id`
* `company_id`
* `expense_date`
* `submission_date`
* `vendor_id`
* `gross_amount`
* `net_amount`
* `vat_amount`
* `vat_rate`
* `vat_recoverable`
* `currency`
* `category`
* `subcategory`
* `business_purpose`
* `project_id` or `cost_center_id`
* `account_id`
* `paid_by` (company | employee)
* `employee_user_id` (nullable)
* `reimbursement_status`
* `approval_status`
* `receipt_id`
* `ocr_data` (json)
* `ocr_confidence`
* `is_backfilled`
* `period_year`
* `period_month`
* `created_by`
* `approved_by`
* `created_at`
* `updated_at`

---

## 4. Vendors Table

Create a dedicated `vendors` table referenced by expenses.

Vendors must include:

* `id`
* `company_id`
* `name`
* `type` (supplier, utility, landlord, government, other)
* `vat_trn`
* `country`
* `default_vat_rate`
* `notes`
* `is_active`
* `created_at`
* `updated_at`

Expenses must reference vendors by **ID only**.
No free-text vendors.

---

## 5. Accounts Table

Create an `accounts` table representing all money sources.

Supported types:

* Bank accounts
* Credit cards
* Cash
* Petty cash
* Employee-held accounts

Fields must include:

* `id`
* `company_id`
* `name`
* `type` (bank, cash, petty_cash, employee)
* `currency`
* `opening_balance`
* `current_balance`
* `linked_user_id` (nullable)
* `is_active`
* `notes`
* `created_at`
* `updated_at`

---

## 6. Company Users and Account Linkage

Design linkage between accounts and company users:

* One user may hold multiple accounts
* Employee-linked accounts are restricted to:

  * Petty cash usage
  * Reimbursable expenses only
* All employee account activity requires approval

Explain how this integrates with:

* Supabase Auth
* Company membership
* Row Level Security (RLS)

---

## 7. Petty Cash Module

Design petty cash handling:

* Petty cash is treated as an account
* Expenses reduce the petty cash balance
* Replenishment creates a transfer entry
* Periodic reconciliation required
* Variances must be explicitly recorded
* Locked after reconciliation

Define:

* Required tables
* Required constraints
* Workflow

---

## 8. VAT Handling (UAE)

Design VAT logic with UAE compliance:

* VAT-inclusive vs VAT-exclusive receipts
* Recoverable vs non-recoverable VAT
* Missing receipt handling (VAT not reclaimable)
* Vendor VAT TRN validation
* Mixed-VAT receipts
* VAT reporting alignment

Ensure VAT integrity during historical backfill.

---

## 9. Reimbursements

Design reimbursement handling:

* Employee-paid expenses
* Partial reimbursements
* Batch reimbursements
* Reimbursement payments
* Linking reimbursements to expenses
* Full audit trail

Define required tables and state transitions.

---

## 10. Period Locking and Controls

Design:

* Monthly `accounting_periods` table
* Locking mechanism
* Adjustment-only entries post-lock
* Protection against silent edits

---

## 11. Supabase Migrations

Produce:

* SQL migration files for all tables
* Proper foreign keys
* Indexes for performance
* Enums where appropriate
* Multi-tenant support (`company_id` everywhere)

Include a **Row Level Security (RLS) strategy summary**.

Assume:

* Supabase Auth
* Multi-company system
* Production-grade constraints

---

## 12. Output Format

Respond with:

1. High-level system architecture
2. SQL table schemas
3. Key relationships
4. RLS strategy overview
5. Assumptions and limitations

Be precise. No fluff. Treat this as a real accounting system.

---

If you want next:

* SQL review and hardening
* RLS policies written in full
* Journal entry system design
* MVP-first cut without breaking accounting

Say the word.
