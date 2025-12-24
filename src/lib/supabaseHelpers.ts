import { supabase } from './supabase';
import {
  createKeyedCache,
  createMemoryCache,
  readLocalCache,
  removeLocalCache,
  removeLocalCacheByPrefix,
  writeLocalCache,
} from './cacheUtils';

const DOCUMENTS_CACHE_TTL_MS = 60_000; // 60 seconds
const DOCUMENT_PAGES_CACHE_TTL_MS = 60_000; // 60 seconds
const KITCHEN_PAGES_CACHE_TTL_MS = 60_000; // 60 seconds
const LIVE_SHOW_PAGES_CACHE_TTL_MS = 60_000; // 60 seconds
const LIST_CACHE_TTL_MS = 60_000; // 60 seconds

const documentsCache = createMemoryCache<Document[]>(DOCUMENTS_CACHE_TTL_MS);
const documentPagesCache = createKeyedCache<{ data: Document[]; total: number }>(DOCUMENT_PAGES_CACHE_TTL_MS);
const kitchenBatchPagesCache = createKeyedCache<{ data: KitchenBatch[]; total: number }>(KITCHEN_PAGES_CACHE_TTL_MS);
const liveShowPagesCache = createKeyedCache<{ data: LiveShow[]; total: number }>(LIVE_SHOW_PAGES_CACHE_TTL_MS);
const itemsCache = createMemoryCache<Item[]>(LIST_CACHE_TTL_MS);
const deliveryProvidersCache = createMemoryCache<DeliveryProvider[]>(LIST_CACHE_TTL_MS);
const liveShowsCache = createMemoryCache<LiveShow[]>(LIST_CACHE_TTL_MS);
const vendorsCache = createMemoryCache<Vendor[]>(LIST_CACHE_TTL_MS);
const accountsCache = createMemoryCache<Account[]>(LIST_CACHE_TTL_MS);
const expenseCategoriesCache = createMemoryCache<ExpenseCategory[]>(LIST_CACHE_TTL_MS);
const expensePagesCache = createKeyedCache<{ data: Expense[]; total: number }>(LIST_CACHE_TTL_MS);

// LocalStorage TTLs (longer-lived than in-memory)
const LOCAL_LIST_CACHE_TTL_MS = 15 * 60_000; // 15 minutes
const LOCAL_PAGE_CACHE_TTL_MS = 15 * 60_000; // 15 minutes
const LOCAL_CLIENTS_CACHE_TTL_MS = 60 * 60_000; // 60 minutes (frequently used in POS)

function nowMs() {
  return Date.now();
}

function getDocumentsCache() {
  return documentsCache.get();
}

function setDocumentsCache(data: Document[]) {
  documentsCache.set(data);
}

function invalidateDocumentsCache() {
  documentsCache.invalidate();
}

function documentPageCacheKey(page: number, pageSize: number, filtersKey: string) {
  return `${page}:${pageSize}:${filtersKey}`;
}

function getDocumentPageCache(key: string) {
  return documentPagesCache.get(key);
}

function setDocumentPageCache(key: string, payload: { data: Document[]; total: number }) {
  documentPagesCache.set(key, payload);
}

function invalidateDocumentPagesCache() {
  documentPagesCache.invalidate();
  removeLocalCacheByPrefix('cache:documents:page:');
}

function expensePageCacheKey(page: number, pageSize: number, filtersKey: string) {
  return `${page}:${pageSize}:${filtersKey}`;
}

function getExpensePageCache(key: string) {
  return expensePagesCache.get(key);
}

function setExpensePageCache(key: string, payload: { data: Expense[]; total: number }) {
  expensePagesCache.set(key, payload);
}

function invalidateExpensePagesCache() {
  expensePagesCache.invalidate();
  removeLocalCacheByPrefix('cache:expenses:page:');
}

function escapeIlike(term: string) {
  return term.replace(/[%_]/g, '\\$&');
}

type NormalizedDocumentFilters = {
  searchTerm: string;
  typeFilter: 'quotation' | 'invoice' | 'delivery_note' | 'all';
  statusFilter: 'draft' | 'sent' | 'paid' | 'cancelled' | 'all';
  originFilter: 'dashboard' | 'pos_in_store' | 'pos_delivery' | 'all';
  dateFrom: string;
  dateTo: string;
  sortColumn: 'created_at' | 'issue_date' | 'document_number' | 'total';
  sortDirection: 'asc' | 'desc';
};

function normalizeDocumentFilters(filters?: DocumentPageFilters): NormalizedDocumentFilters {
  const allowedTypes = new Set(['quotation', 'invoice', 'delivery_note']);
  const allowedStatuses = new Set(['draft', 'sent', 'paid', 'cancelled']);
  const allowedOrigins = new Set(['dashboard', 'pos_in_store', 'pos_delivery']);
  const allowedSortColumns = new Set(['created_at', 'issue_date', 'document_number', 'total']);
  const sortDirection = filters?.sortDirection === 'asc' ? 'asc' : 'desc';
  const sortColumn = allowedSortColumns.has(filters?.sortColumn || '')
    ? (filters?.sortColumn as 'created_at' | 'issue_date' | 'document_number' | 'total')
    : 'created_at';
  const typeFilter = filters?.filterType && allowedTypes.has(filters.filterType) ? filters.filterType : 'all';
  const statusFilter = filters?.filterStatus && allowedStatuses.has(filters.filterStatus) ? filters.filterStatus : 'all';
  const originFilter = filters?.filterOrigin && allowedOrigins.has(filters.filterOrigin) ? filters.filterOrigin : 'all';
  const searchTerm = (filters?.searchTerm || '').trim();
  const dateFrom = (filters?.filterDateFrom || '').trim();
  const dateTo = (filters?.filterDateTo || '').trim();

  return {
    searchTerm,
    typeFilter,
    statusFilter,
    originFilter,
    dateFrom,
    dateTo,
    sortColumn,
    sortDirection,
  };
}

function applyDocumentFilters(query: any, normalized: NormalizedDocumentFilters) {
  if (normalized.typeFilter !== 'all') query.eq('document_type', normalized.typeFilter);
  if (normalized.statusFilter !== 'all') query.eq('status', normalized.statusFilter);
  if (normalized.originFilter === 'dashboard') {
    query.or('origin.eq.dashboard,origin.is.null');
  } else if (normalized.originFilter !== 'all') {
    query.eq('origin', normalized.originFilter);
  }
  if (normalized.dateFrom) query.gte('issue_date', normalized.dateFrom);
  if (normalized.dateTo) query.lte('issue_date', normalized.dateTo);
  if (normalized.searchTerm) {
    const escaped = escapeIlike(normalized.searchTerm);
    query.or(`document_number.ilike.%${escaped}%,client_name.ilike.%${escaped}%`);
  }
  query.order(normalized.sortColumn, { ascending: normalized.sortDirection === 'asc' });
  return query;
}

type NormalizedExpenseFilters = {
  searchTerm: string;
  vendorId?: string;
  accountId?: string;
  category?: string;
  isBackfilled: boolean | 'all';
  approvalStatus: ExpenseApprovalStatus | 'all';
  reimbursementStatus: ExpenseReimbursementStatus | 'all';
  paidBy: 'company' | 'employee' | 'all';
  periodYear?: number;
  periodMonth?: number;
  sortColumn: 'expense_date' | 'created_at' | 'gross_amount';
  sortDirection: 'asc' | 'desc';
};

function normalizeExpenseFilters(filters?: ExpensePageFilters): NormalizedExpenseFilters {
  const sortDirection = filters?.sortDirection === 'asc' ? 'asc' : 'desc';
  const allowedSortColumns = new Set(['expense_date', 'created_at', 'gross_amount']);
  const sortColumn = allowedSortColumns.has(filters?.sortColumn || '')
    ? (filters?.sortColumn as 'expense_date' | 'created_at' | 'gross_amount')
    : 'expense_date';
  return {
    searchTerm: (filters?.searchTerm || '').trim(),
    vendorId: filters?.vendorId || undefined,
    accountId: filters?.accountId || undefined,
    category: filters?.category || undefined,
    isBackfilled: typeof filters?.isBackfilled === 'boolean' ? filters.isBackfilled : 'all',
    approvalStatus: (filters?.approvalStatus && filters.approvalStatus !== 'all') ? filters.approvalStatus : 'all',
    reimbursementStatus: (filters?.reimbursementStatus && filters.reimbursementStatus !== 'all') ? filters.reimbursementStatus : 'all',
    paidBy: filters?.paidBy || 'all',
    periodYear: filters?.periodYear || undefined,
    periodMonth: filters?.periodMonth || undefined,
    sortColumn,
    sortDirection,
  };
}

function applyExpenseFilters(query: any, normalized: NormalizedExpenseFilters) {
  if (normalized.vendorId) query.eq('vendor_id', normalized.vendorId);
  if (normalized.accountId) query.eq('account_id', normalized.accountId);
  if (normalized.category) query.ilike('category', `%${escapeIlike(normalized.category)}%`);
  if (normalized.isBackfilled !== 'all') query.eq('is_backfilled', normalized.isBackfilled);
  if (normalized.approvalStatus !== 'all') query.eq('approval_status', normalized.approvalStatus);
  if (normalized.reimbursementStatus !== 'all') query.eq('reimbursement_status', normalized.reimbursementStatus);
  if (normalized.paidBy !== 'all') query.eq('paid_by', normalized.paidBy);
  if (normalized.periodYear) query.eq('period_year', normalized.periodYear);
  if (normalized.periodMonth) query.eq('period_month', normalized.periodMonth);
  if (normalized.searchTerm) {
    const escaped = escapeIlike(normalized.searchTerm);
    query.or(`business_purpose.ilike.%${escaped}%,category.ilike.%${escaped}%,subcategory.ilike.%${escaped}%`);
  }
  query.order(normalized.sortColumn, { ascending: normalized.sortDirection === 'asc' });
  return query;
}

function kitchenBatchPageCacheKey(page: number, pageSize: number) {
  return `${page}:${pageSize}`;
}

function getKitchenBatchPageCache(key: string) {
  return kitchenBatchPagesCache.get(key);
}

function setKitchenBatchPageCache(key: string, payload: { data: KitchenBatch[]; total: number }) {
  kitchenBatchPagesCache.set(key, payload);
}

function invalidateKitchenBatchPagesCache() {
  kitchenBatchPagesCache.invalidate();
  removeLocalCacheByPrefix('cache:kitchen_batches:page:');
}

function liveShowPageCacheKey(page: number, pageSize: number) {
  return `${page}:${pageSize}`;
}

function getLiveShowPageCache(key: string) {
  return liveShowPagesCache.get(key);
}

function setLiveShowPageCache(key: string, payload: { data: LiveShow[]; total: number }) {
  liveShowPagesCache.set(key, payload);
}

function invalidateLiveShowPagesCache() {
  liveShowPagesCache.invalidate();
  removeLocalCacheByPrefix('cache:live_shows:page:');
}

function getItemsCache() {
  return itemsCache.get();
}

function setItemsCache(data: Item[]) {
  itemsCache.set(data);
}

function invalidateItemsCache() {
  itemsCache.invalidate();
  removeLocalCache('cache:items:list');
}

function getDeliveryProvidersCache() {
  return deliveryProvidersCache.get();
}

function setDeliveryProvidersCache(data: DeliveryProvider[]) {
  deliveryProvidersCache.set(data);
}

function invalidateDeliveryProvidersCache() {
  deliveryProvidersCache.invalidate();
  removeLocalCache('cache:delivery_providers:list');
}

function getLiveShowsCache() {
  return liveShowsCache.get();
}

function setLiveShowsCache(data: LiveShow[]) {
  liveShowsCache.set(data);
}

function invalidateLiveShowsCache() {
  liveShowsCache.invalidate();
  removeLocalCache('cache:live_shows:list');
}

async function generateDocumentNumberInternal(type: 'quotation' | 'invoice' | 'delivery_note'): Promise<string> {
  const prefix = type === 'quotation' ? 'q' : type === 'invoice' ? 'r' : 'd';
  const today = new Date();
  const dateStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('');
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('document_number, document_type')
      .eq('document_type', type);
    if (error) throw error;

    const docs = (data || []) as Array<{ document_number: string; document_type: string }>;
    const filtered = docs
      .filter(
        (d) =>
          d.document_number &&
          d.document_number.startsWith(`${prefix}-${dateStr}`) &&
          /^\d+$/.test(d.document_number.slice(`${prefix}-${dateStr}`.length))
      )
      .sort((a, b) => b.document_number.localeCompare(a.document_number));

    let next = 1;
    if (filtered.length > 0) {
      const suffix = filtered[0].document_number.slice(`${prefix}-${dateStr}`.length);
      const last = parseInt(suffix, 10);
      next = (isNaN(last) ? 0 : last) + 1;
    }
    return `${prefix}-${dateStr}${next.toString().padStart(3, '0')}`;
  } catch (e) {
    console.error('Error generating document number:', e);
    return `${prefix}-${dateStr}001`;
  }
}

export type Client = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  trn?: string;
  emirate?: string;
  created_at?: string;
  updated_at?: string;
  user_id: string;
};

export type DocumentStatus = 'draft' | 'sent' | 'paid' | 'cancelled';
export type Document = {
  id: string;
  document_type: string;
  document_number: string;
  client_id?: string | null;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  client_address?: string;
  client_trn?: string;
  client_emirate?: string;
  issue_date?: string;
  due_date?: string;
  subtotal?: number;
  tax_amount?: number;
  discount_amount?: number;
  total?: number;
  notes?: string;
  terms?: string;
  status?: DocumentStatus;
  origin?: 'dashboard' | 'pos_in_store' | 'pos_delivery';
  payment_method?: string;
  payment_card_amount?: number;
  payment_cash_amount?: number;
  delivery_fee?: number;
  delivery_provider_id?: string | null;
  created_at?: string;
  updated_at?: string;
  user_id: string;
};

export type DocumentPageFilters = {
  searchTerm?: string;
  filterType?: 'quotation' | 'invoice' | 'delivery_note' | 'all';
  filterStatus?: DocumentStatus | 'all';
  filterOrigin?: 'dashboard' | 'pos_in_store' | 'pos_delivery' | 'all';
  filterDateFrom?: string;
  filterDateTo?: string;
  sortColumn?: 'created_at' | 'issue_date' | 'document_number' | 'total';
  sortDirection?: 'asc' | 'desc';
};

export type ExpensePageFilters = {
  searchTerm?: string;
  vendorId?: string;
  accountId?: string;
  category?: string;
  isBackfilled?: boolean | 'all';
  approvalStatus?: ExpenseApprovalStatus | 'all';
  reimbursementStatus?: ExpenseReimbursementStatus | 'all';
  paidBy?: 'company' | 'employee' | 'all';
  periodYear?: number;
  periodMonth?: number;
  sortColumn?: 'expense_date' | 'created_at' | 'gross_amount';
  sortDirection?: 'asc' | 'desc';
};

export type DocumentItem = {
  id: string;
  document_id?: string;
  description: string;
  quantity?: number;
  weight?: number;
  sell_by?: 'unit' | 'weight';
  item_id?: string | null;
  unit_price?: number;
  amount?: number;
  created_at?: string;
  user_id: string;
};

export type CompanySettings = {
  id: string;
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  company_trn?: string;
  company_logo_url?: string;
  company_stamp_url?: string;
  default_terms?: string;
  tax_rate?: number;
  created_at?: string;
  updated_at?: string;
  user_id: string;
};

// Catalog item for admin & POS product list
export type Item = {
  id: string;
  company_id?: string | null;
  user_id: string;
  name: string;
  sku?: string | null;
  price: number;
  sell_by?: 'unit' | 'weight';
  created_at?: string;
  updated_at?: string;
};

// Delivery provider entity
export type DeliveryProvider = {
  id: string;
  company_id?: string | null;
  name: string;
  phone?: string | null;
  method?: string | null;
  managed?: boolean | null;
  price_multiplier?: number | null;
  created_at?: string;
};

// Delivery provider per-item override (server-backed)
export type DeliveryProviderOverride = {
  id: string;
  company_id?: string | null;
  provider_id: string;
  item_id: string;
  sku?: string | null;
  price: number;
  created_at?: string;
};

export type VendorType = 'supplier' | 'utility' | 'landlord' | 'government' | 'other';
export type Vendor = {
  id: string;
  company_id?: string | null;
  name: string;
  type: VendorType;
  phone?: string | null;
  manager_phone?: string | null;
  vat_trn?: string | null;
  country?: string | null;
  default_vat_rate?: number | null;
  notes?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ExpenseCategoryVatTreatment = 'recoverable' | 'non_recoverable' | 'mixed';
export type ExpenseCategory = {
  id: string;
  company_id?: string | null;
  name: string;
  code: string;
  parent_category_id?: string | null;
  ledger_account_code?: string | null;
  default_vat_treatment?: ExpenseCategoryVatTreatment | null;
  requires_receipt?: boolean | null;
  requires_approval_above?: number | null;
  is_active: boolean;
  policy_notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CashDailyBalance = {
  id: string;
  company_id?: string | null;
  account_id: string;
  entry_date: string;
  opening_amount: number;
  closing_amount?: number | null;
  difference?: number | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AccountType = 'bank' | 'cash' | 'petty_cash' | 'employee' | 'credit_card';
export type Account = {
  id: string;
  company_id?: string | null;
  name: string;
  type: AccountType;
  currency?: string;
  opening_balance?: number;
  current_balance?: number;
  linked_user_id?: string | null;
  is_active: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ExpenseApprovalStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'locked';
export type ExpenseReimbursementStatus = 'not_required' | 'pending' | 'partial' | 'reimbursed';
export type ExpenseVatInputType = 'inclusive' | 'exclusive';
export type ExpenseVatTreatment =
  | 'recoverable'
  | 'partially_recoverable'
  | 'non_recoverable'
  | 'exempt'
  | 'zero_rated'
  | 'out_of_scope';
export type Expense = {
  id: string;
  company_id?: string | null;
  expense_date: string;
  submission_date?: string;
  vendor_id?: string | null;
  gross_amount: number;
  net_amount: number;
  vat_amount: number;
  vat_rate: number;
  vat_recoverable: boolean;
  vat_input_type?: ExpenseVatInputType | null;
  vat_treatment?: ExpenseVatTreatment | null;
  recoverable_vat_amount?: number | null;
  non_recoverable_vat_amount?: number | null;
  currency: string;
  category_id?: string | null;
  category?: string | null;
  subcategory?: string | null;
  business_purpose?: string | null;
  project_id?: string | null;
  cost_center_id?: string | null;
  account_id?: string | null;
  paid_by: 'company' | 'employee';
  is_reimbursable?: boolean | null;
  employee_user_id?: string | null;
  reimbursement_status: ExpenseReimbursementStatus;
  approval_status: ExpenseApprovalStatus;
  receipt_id?: string | null;
  receipt_url?: string | null;
  has_receipt?: boolean | null;
  receipt_lost?: boolean | null;
  ocr_data?: any;
  ocr_confidence?: number | null;
  is_backfilled: boolean;
  period_year: number;
  period_month: number;
  created_by?: string | null;
  approved_by?: string | null;
  created_at?: string;
  updated_at?: string;
  vendor?: Vendor | null;
  account?: Account | null;
};

export type AccountingPeriodStatus = 'open' | 'locked' | 'backfill_locked';
export type AccountingPeriod = {
  company_id: string;
  period_year: number;
  period_month: number;
  status: AccountingPeriodStatus;
  locked_by?: string | null;
  locked_at?: string | null;
  notes?: string | null;
};

// Kitchen Stopwatch Module types
export type KitchenBatchStatus = 'in_progress' | 'completed' | 'validated';
export type KitchenValidationStatus = 'good' | 'moderate' | 'shift_detected' | null;

export type KitchenProcessType = {
  id: string;
  company_id?: string;
  name: string;
  standard_duration_minutes: number;
  variation_buffer_minutes: number;
  active: boolean;
  created_by?: string;
  created_at?: string;
};

export type KitchenBatch = {
  id: string;
  company_id: string;
  halwa_type: string;
  starch_weight: number;
  chef_id: string;
  chef_name?: string;
  start_time: string;
  end_time?: string | null;
  total_duration?: number | null;
  status: KitchenBatchStatus;
  validation_status?: KitchenValidationStatus;
  validated_by?: string | null;
  validation_comments?: string | null;
  created_by: string;
  created_at: string;
};

export type CompanyUser = {
  user_id: string;
  company_id: string;
  role: string;
  display_name?: string | null;
};

export type KitchenProcess = {
  id: string;
  batch_id: string;
  company_id: string;
  process_type_id: string;
  start_time?: string | null;
  end_time?: string | null;
  duration_minutes?: number | null;
  remarks?: string | null;
  auto_recorded: boolean;
  created_by: string;
  created_at: string;
};

export type HalwaType = {
  id: string;
  company_id: string;
  name: string;
  base_process_count: number;
  active: boolean;
  created_by: string;
  created_at: string;
};

export type HalwaProcessMap = {
  id: string;
  halwa_type_id: string;
  process_type_id: string;
  sequence_order: number;
  additional_processes: number;
  created_by: string;
  created_at: string;
};

// Live Show POS Module types
export type LiveShowStatus = 'quotation' | 'advanced_paid' | 'fully_paid' | 'cancelled';

export type LiveShow = {
  id: string;
  company_id?: string;
  client_id: string;
  show_number: string;
  location?: string | null;
  show_date?: string | null; // ISO date string (YYYY-MM-DD)
  show_time?: string | null;
  item_name?: string | null;
  kg?: number | null;
  people_count?: number | null;
  notes?: string | null;
  status: LiveShowStatus;
  calendar_event_id?: string | null;
  created_by?: string | null;
  created_at?: string;
};

export type LiveShowQuotation = {
  id: string;
  company_id?: string;
  live_show_id: string;
  quotation_number: string;
  total_estimated?: number | null;
  created_by?: string | null;
  created_at?: string;
};

export type LiveShowPaymentType = 'advance' | 'full';
export type LiveShowPaymentMethod = 'cash' | 'transfer';

export type LiveShowPayment = {
  id: string;
  company_id?: string;
  live_show_id: string;
  quotation_id?: string | null;
  payment_type: LiveShowPaymentType;
  amount: number;
  method: LiveShowPaymentMethod;
  created_by?: string | null;
  created_at?: string;
};

export const supabaseHelpers = {
  async uploadCompanyAsset(file: File, kind: 'logo' | 'stamp'): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const bucket = (import.meta as any).env?.VITE_SUPABASE_COMPANY_BUCKET || 'company-assets';
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const safeExt = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext) ? ext : 'png';
    const path = `${user.id}/${kind}/${Date.now()}_${Math.random().toString(36).slice(2)}.${safeExt}`;

    const { error: uploadErr } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (uploadErr) {
      const msg = (uploadErr as any)?.message || String(uploadErr);
      if (msg.toLowerCase().includes('bucket not found')) {
        throw new Error(
          `Storage bucket "${bucket}" not found. Create it in Supabase (Storage → New bucket) and set it public, or set VITE_SUPABASE_COMPANY_BUCKET to an existing bucket.`
        );
      }
      throw uploadErr;
    }

    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    if (!pub?.publicUrl) throw new Error('Failed to resolve public URL');
    return pub.publicUrl;
  },
  async resolveCompanyId(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    // Try company_users first (handle users in multiple companies by taking the first)
    const { data: cuRows, error: cuErr } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', user.id)
      .limit(1);
    if (cuErr) {
      console.warn('resolveCompanyId: company_users query error', cuErr);
    }
    const cuId = Array.isArray(cuRows) && cuRows.length > 0 ? cuRows[0]?.company_id : null;
    if (cuId) return cuId as string;
    // Fallback to company_settings (take the first if multiple rows)
    const { data: csRows, error: csErr } = await supabase
      .from('company_settings')
      .select('company_id')
      .eq('user_id', user.id)
      .limit(1);
    if (csErr) {
      console.warn('resolveCompanyId: company_settings query error', csErr);
    }
    const csId = Array.isArray(csRows) && csRows.length > 0 ? csRows[0]?.company_id : null;
    return (csId as string) || null;
  },

  async getCurrentUserRole(): Promise<'admin' | 'manager' | 'sales' | null> {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;
    if (!userId) return null;
    const { data, error } = await supabase
      .from('company_users')
      .select('role')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn('Failed to resolve user role', error);
      return null;
    }
    return (data?.role as 'admin' | 'manager' | 'sales' | undefined) || null;
  },

  // --- Live Shows helpers ---
  async generateLiveShowNumber(): Promise<string> {
    const prefix = 'ls';
    const today = new Date();
    const dateStr = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('');
    try {
      const { data, error } = await supabase
        .from('live_shows')
        .select('show_number');
      if (error) throw error;
      const rows = (data || []) as Array<{ show_number: string }>; 
      const filtered = rows
        .filter((r) => r.show_number && r.show_number.startsWith(`${prefix}-${dateStr}`) && /^\d+$/.test(r.show_number.slice(`${prefix}-${dateStr}`.length)))
        .sort((a, b) => b.show_number.localeCompare(a.show_number));
      let next = 1;
      if (filtered.length > 0) {
        const suffix = filtered[0].show_number.slice(`${prefix}-${dateStr}`.length);
        const last = parseInt(suffix, 10);
        next = (isNaN(last) ? 0 : last) + 1;
      }
      return `${prefix}-${dateStr}${next.toString().padStart(3, '0')}`;
    } catch (e) {
      console.error('Error generating live show number:', e);
      return `ls-${dateStr}001`;
    }
  },

  async getLiveShows(): Promise<LiveShow[]> {
    const cached = getLiveShowsCache();
    if (cached) {
      return cached;
    }
    const lsKey = 'cache:live_shows:list';
    const lsCached = readLocalCache<LiveShow[]>(lsKey);
    if (lsCached && nowMs() - lsCached.timestamp < LOCAL_LIST_CACHE_TTL_MS) {
      const data = (lsCached.data || []) as LiveShow[];
      setLiveShowsCache(data);
      return data;
    }
    // Fallback to Supabase
    const { data, error } = await supabase
      .from('live_shows')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const shows = (data || []) as LiveShow[];
    setLiveShowsCache(shows);
    writeLocalCache(lsKey, { data: shows });
    return shows;
  },

  async getLiveShowsPage(page: number, pageSize: number): Promise<{ data: LiveShow[]; total: number }> {
    const companyId = await supabaseHelpers.resolveCompanyId();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const key = liveShowPageCacheKey(page, pageSize);
    const memoryCached = getLiveShowPageCache(key);
    if (memoryCached) {
      return memoryCached;
    }
    const lsKey = `cache:live_shows:page:${companyId}:${key}`;
    const lsCached = readLocalCache<LiveShow[]>(lsKey);
    if (lsCached && nowMs() - lsCached.timestamp < LOCAL_PAGE_CACHE_TTL_MS) {
      const payload = { data: (lsCached.data || []) as LiveShow[], total: Number((lsCached as any).total) || 0 };
      setLiveShowPageCache(key, payload);
      return payload;
    }
    // Fallback to Supabase
    const { data, error, count } = await supabase
      .from('live_shows')
      .select('*', { count: 'planned' })
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    const payload = { data: (data || []) as LiveShow[], total: count || 0 };
    setLiveShowPageCache(key, payload);
    writeLocalCache(lsKey, payload);
    return payload;
  },

  async getLiveShowById(id: string): Promise<LiveShow | null> {
    const { data, error } = await supabase
      .from('live_shows')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data || null) as LiveShow | null;
  },

  async getLiveShowQuotations(liveShowId: string): Promise<LiveShowQuotation[]> {
    const { data, error } = await supabase
      .from('live_show_quotations')
      .select('*')
      .eq('live_show_id', liveShowId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []) as LiveShowQuotation[];
  },

  async getLiveShowPayments(liveShowId: string): Promise<LiveShowPayment[]> {
    const { data, error } = await supabase
      .from('live_show_payments')
      .select('*')
      .eq('live_show_id', liveShowId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []) as LiveShowPayment[];
  },

  async createLiveShowAndQuotation(payload: {
    client: { id?: string; name: string; phone?: string; email?: string; address?: string; trn?: string; emirate?: string };
    show_date?: string;
    show_time?: string;
    item_name?: string;
    kg?: number;
    people_count?: number;
    location?: string;
    notes?: string;
    estimated_total?: number;
  }): Promise<{ show: LiveShow; quotation: LiveShowQuotation; document?: Document }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Resolve or create client
    let clientId = payload.client.id;
    let client: Client | null = null;
    if (clientId) {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .maybeSingle();
      client = (data || null) as Client | null;
    }
    if (!client) {
      client = await supabaseHelpers.findOrCreateClient({
        name: payload.client.name,
        phone: payload.client.phone,
        email: payload.client.email,
        address: payload.client.address,
        trn: payload.client.trn,
        emirate: payload.client.emirate,
      });
    }

    // Create live show
    const showNumber = await supabaseHelpers.generateLiveShowNumber();
    const { data: showRow, error: showErr } = await supabase
      .from('live_shows')
      .insert({
        client_id: client.id,
        show_number: showNumber,
        location: payload.location || null,
        show_date: payload.show_date || null,
        show_time: payload.show_time || null,
        item_name: payload.item_name || null,
        kg: typeof payload.kg === 'number' ? payload.kg : null,
        people_count: typeof payload.people_count === 'number' ? payload.people_count : null,
        notes: payload.notes || null,
        status: 'quotation',
        created_by: user.id,
      })
      .select('*')
      .single();
    if (showErr) throw showErr;
    const show = showRow as LiveShow;

    // Create quotation record (number aligns with Document quotation for printing)
    const estimated = Math.max(0, Number(payload.estimated_total || 0));

    // Optionally create a Document 'quotation' to leverage existing print flow
    const issueDate = new Date().toISOString().split('T')[0];
    const settings = await supabaseHelpers.getCompanySettings();
    const taxRate = settings?.tax_rate || 0;
    const subtotal = estimated;
    const taxableBase = Math.max(subtotal, 0);
    const taxAmount = (taxableBase * taxRate) / 100;
    const total = taxableBase + taxAmount;

    const quotationNumber = await generateDocumentNumberInternal('quotation');
    const doc = await supabaseHelpers.createDocument({
      document_type: 'quotation',
      document_number: quotationNumber,
      client_id: client.id,
      client_name: client.name,
      client_email: client.email || '',
      client_phone: client.phone || '',
      client_address: client.address || '',
      client_trn: client.trn || '',
      client_emirate: client.emirate || '',
      issue_date: issueDate,
      subtotal,
      tax_amount: taxAmount,
      discount_amount: 0,
      total,
      notes: `Live Show Quotation for ${payload.item_name || 'Halwa'}${payload.people_count ? `, ${payload.people_count} people` : ''}${payload.location ? ` at ${payload.location}` : ''}${payload.show_date ? ` on ${payload.show_date}` : ''}${payload.show_time ? ` at ${payload.show_time}` : ''}`,
      terms: settings?.default_terms || '',
      status: 'sent',
      origin: 'dashboard',
      delivery_fee: 0,
      delivery_provider_id: null,
    });

    // Add a single item line to the quotation document
    if (subtotal > 0) {
      await supabaseHelpers.createDocumentItem({
        document_id: doc.id,
        description: `Live Show: ${payload.item_name || 'Halwa'}${payload.people_count ? `, ${payload.people_count} people` : ''}`,
        quantity: 1,
        weight: 0,
        sell_by: 'unit',
        item_id: null,
        unit_price: subtotal,
        amount: subtotal,
      });
    }

    const { data: qRow, error: qErr } = await supabase
      .from('live_show_quotations')
      .insert({
        live_show_id: show.id,
        quotation_number: doc.document_number,
        total_estimated: estimated,
        created_by: user.id,
      })
      .select('*')
      .single();
    if (qErr) throw qErr;
    const quotation = qRow as LiveShowQuotation;

    // Invalidate caches so UI reflects the new live show
    invalidateLiveShowsCache();
    invalidateLiveShowPagesCache();
    return { show, quotation, document: doc };
  },

  async recordLiveShowPayment(liveShowId: string, payment: { type: LiveShowPaymentType; amount: number; method: LiveShowPaymentMethod; quotation_id?: string | null }): Promise<LiveShowPayment> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    const amt = Math.max(0, Number(payment.amount));
    const { data, error } = await supabase
      .from('live_show_payments')
      .insert({
        live_show_id: liveShowId,
        quotation_id: payment.quotation_id ?? null,
        payment_type: payment.type,
        amount: amt,
        method: payment.method,
        created_by: user.id,
      })
      .select('*')
      .single();
    if (error) throw error;

    // Update live show status
    const newStatus: LiveShowStatus = payment.type === 'advance' ? 'advanced_paid' : 'fully_paid';
    const { error: upErr } = await supabase
      .from('live_shows')
      .update({ status: newStatus })
      .eq('id', liveShowId);
    if (upErr) throw upErr;

    // Invalidate caches so status changes reflect in list immediately
    invalidateLiveShowsCache();
    invalidateLiveShowPagesCache();
    return data as LiveShowPayment;
  },

  async createAdvanceReceiptForLiveShow(liveShowId: string, options: { amount: number; method: LiveShowPaymentMethod; issueDate?: string }): Promise<Document> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const show = await supabaseHelpers.getLiveShowById(liveShowId);
    if (!show) throw new Error('Live show not found');

    const client = await supabaseHelpers.getClientById(show.client_id);
    if (!client) throw new Error('Client not found for live show');

    const settings = await supabaseHelpers.getCompanySettings();
    const taxRate = settings?.tax_rate || 0;
    const subtotal = Math.max(0, Number(options.amount || 0));
    const taxableBase = Math.max(subtotal, 0);
    const taxAmount = (taxableBase * taxRate) / 100;
    const total = taxableBase + taxAmount;

    const issueDate = options.issueDate || new Date().toISOString().split('T')[0];
    const invoiceNumber = await generateDocumentNumberInternal('invoice');

    const notes = `Advance Payment for Live Show ${show.show_number}` +
      `${show.item_name ? ` (${show.item_name})` : ''}` +
      `${show.people_count ? `, ${show.people_count} people` : ''}` +
      `${show.location ? ` at ${show.location}` : ''}` +
      `${show.show_date ? ` on ${show.show_date}` : ''}` +
      `${show.show_time ? ` at ${show.show_time}` : ''}`;

    const normalizedMethod = options.method === 'cash' ? 'cash' : 'transfer';
    const paymentCashAmount = normalizedMethod === 'cash' ? total : 0;

    const invoice = await supabaseHelpers.createDocument({
      document_type: 'invoice',
      document_number: invoiceNumber,
      client_id: client.id,
      client_name: client.name,
      client_email: client.email || '',
      client_phone: client.phone || '',
      client_address: client.address || '',
      client_trn: client.trn || '',
      client_emirate: client.emirate || '',
      issue_date: issueDate,
      subtotal,
      tax_amount: taxAmount,
      discount_amount: 0,
      total,
      notes,
      terms: settings?.default_terms || '',
      status: 'paid',
      origin: 'dashboard',
      payment_method: normalizedMethod,
      payment_card_amount: 0,
      payment_cash_amount: paymentCashAmount,
      delivery_fee: 0,
      delivery_provider_id: null,
    });

    await supabaseHelpers.createDocumentItem({
      document_id: invoice.id,
      description: `Advance Payment (${show.show_number})`,
      quantity: 1,
      weight: 0,
      sell_by: 'unit',
      item_id: null,
      unit_price: subtotal,
      amount: subtotal,
    });

    return invoice;
  },

  async updateLiveShowPaymentDate(paymentId: string, newDateISO: string): Promise<LiveShowPayment> {
    // Updates the created_at timestamp of a live_show_payment.
    // Requires appropriate role permissions (admin/manager) per RLS policies.
    const { data, error } = await supabase
      .from('live_show_payments')
      .update({ created_at: newDateISO })
      .eq('id', paymentId)
      .select('*')
      .single();
    if (error) throw error;
    return data as LiveShowPayment;
  },

  async cancelLiveShow(liveShowId: string, reason?: string): Promise<LiveShow> {
    const { data, error } = await supabase
      .from('live_shows')
      .update({ status: 'cancelled', notes: reason || null })
      .eq('id', liveShowId)
      .select('*')
      .single();
    if (error) throw error;
    // Invalidate caches so cancellation reflects in list immediately
    invalidateLiveShowsCache();
    invalidateLiveShowPagesCache();
    return data as LiveShow;
  },

  async deleteLiveShow(id: string): Promise<void> {
    // Delete any linked quotation documents first (DB cascades will remove rows in live_show_quotations/payments)
    try {
      const { data: qRows, error: qErr } = await supabase
        .from('live_show_quotations')
        .select('quotation_number')
        .eq('live_show_id', id);
      if (qErr) throw qErr;
      const quotationNumbers = (qRows || []).map((q: any) => q.quotation_number).filter(Boolean);
      for (const qNum of quotationNumbers) {
        const { data: docRow, error: docErr } = await supabase
          .from('documents')
          .select('id')
          .eq('document_type', 'quotation')
          .eq('document_number', qNum)
          .maybeSingle();
        if (docErr) throw docErr;
        const docId = docRow?.id as string | undefined;
        if (docId) {
          await supabaseHelpers.deleteDocument(docId);
        }
      }
    } catch (e) {
      // Non-fatal; proceed with live show deletion even if quotations cleanup fails
      console.warn('Quotation document cleanup failed during live show delete', e);
    }

    const { error } = await supabase
      .from('live_shows')
      .delete()
      .eq('id', id);
    if (error) throw error;
    // Invalidate caches so deletion reflects in list immediately
    invalidateLiveShowsCache();
    invalidateLiveShowPagesCache();
  },

  // -------- Expenses & Vendors --------
  async getVendors(): Promise<Vendor[]> {
    const cached = vendorsCache.get();
    if (cached) return cached;
    const companyId = await supabaseHelpers.resolveCompanyId();
    const lsKey = `cache:vendors:list:${companyId || 'none'}`;
    const lsCached = readLocalCache<Vendor[]>(lsKey);
    if (lsCached && nowMs() - lsCached.timestamp < LOCAL_LIST_CACHE_TTL_MS) {
      const data = (lsCached.data || []) as Vendor[];
      vendorsCache.set(data);
      return data;
    }
    const query = supabase.from('vendors').select('*').order('name', { ascending: true });
    if (companyId) query.eq('company_id', companyId);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data || []) as Vendor[];
    vendorsCache.set(rows);
    writeLocalCache(lsKey, { data: rows });
    return rows;
  },

  async createVendor(payload: {
    name: string;
    type?: VendorType;
    phone?: string | null;
    manager_phone?: string | null;
    vat_trn?: string | null;
    country?: string | null;
    default_vat_rate?: number | null;
    notes?: string | null;
  }): Promise<Vendor> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    const { data, error } = await supabase
      .from('vendors')
      .insert({
        name: payload.name.trim(),
        type: payload.type || 'supplier',
        phone: (payload as any).phone || null,
        manager_phone: (payload as any).manager_phone || null,
        vat_trn: payload.vat_trn || null,
        country: payload.country || null,
        default_vat_rate: typeof payload.default_vat_rate === 'number' ? payload.default_vat_rate : null,
        notes: payload.notes || null,
        created_by: user.id,
      })
      .select('*')
      .single();
    if (error) throw error;
    vendorsCache.invalidate();
    removeLocalCacheByPrefix('cache:vendors:list:');
    return data as Vendor;
  },

  async updateVendor(id: string, updates: Partial<Pick<Vendor, 'name' | 'type' | 'phone' | 'manager_phone' | 'vat_trn' | 'country' | 'default_vat_rate' | 'notes' | 'is_active'>>): Promise<void> {
    const { error } = await supabase
      .from('vendors')
      .update({
        name: updates.name?.trim(),
        type: updates.type,
        phone: (updates as any).phone ?? undefined,
        manager_phone: (updates as any).manager_phone ?? undefined,
        vat_trn: updates.vat_trn ?? null,
        country: updates.country ?? null,
        default_vat_rate: typeof updates.default_vat_rate === 'number' ? updates.default_vat_rate : undefined,
        notes: updates.notes ?? null,
        is_active: updates.is_active,
      })
      .eq('id', id);
    if (error) throw error;
    vendorsCache.invalidate();
    removeLocalCacheByPrefix('cache:vendors:list:');
  },

  async archiveVendor(id: string): Promise<void> {
    const { error } = await supabase
      .from('vendors')
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw error;
    vendorsCache.invalidate();
    removeLocalCacheByPrefix('cache:vendors:list:');
  },

  async getExpenseCategories(): Promise<ExpenseCategory[]> {
    const cached = expenseCategoriesCache.get();
    if (cached) return cached;
    const companyId = await supabaseHelpers.resolveCompanyId();
    const lsKey = `cache:expense_categories:list:${companyId || 'none'}`;
    const lsCached = readLocalCache<ExpenseCategory[]>(lsKey);
    if (lsCached && nowMs() - lsCached.timestamp < LOCAL_LIST_CACHE_TTL_MS) {
      const data = (lsCached.data || []) as ExpenseCategory[];
      expenseCategoriesCache.set(data);
      return data;
    }
    const query = supabase.from('expense_categories').select('*').order('name', { ascending: true });
    if (companyId) query.eq('company_id', companyId);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data || []) as ExpenseCategory[];
    expenseCategoriesCache.set(rows);
    writeLocalCache(lsKey, { data: rows });
    return rows;
  },

  async createExpenseCategory(payload: {
    name: string;
    code: string;
    parent_category_id?: string | null;
    ledger_account_code?: string | null;
    default_vat_treatment?: ExpenseCategoryVatTreatment | null;
    requires_receipt?: boolean | null;
    requires_approval_above?: number | null;
    is_active?: boolean;
    policy_notes?: string | null;
  }): Promise<ExpenseCategory> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    const { data, error } = await supabase
      .from('expense_categories')
      .insert({
        name: payload.name.trim(),
        code: payload.code.trim(),
        parent_category_id: payload.parent_category_id || null,
        ledger_account_code: payload.ledger_account_code || null,
        default_vat_treatment: payload.default_vat_treatment || 'recoverable',
        requires_receipt: payload.requires_receipt ?? false,
        requires_approval_above: typeof payload.requires_approval_above === 'number' ? payload.requires_approval_above : null,
        is_active: payload.is_active ?? true,
        policy_notes: payload.policy_notes || null,
        created_by: user.id,
      })
      .select('*')
      .single();
    if (error) throw error;
    expenseCategoriesCache.invalidate();
    removeLocalCacheByPrefix('cache:expense_categories:list:');
    return data as ExpenseCategory;
  },

  async updateExpenseCategory(id: string, updates: Partial<Pick<ExpenseCategory, 'name' | 'code' | 'parent_category_id' | 'ledger_account_code' | 'default_vat_treatment' | 'requires_receipt' | 'requires_approval_above' | 'is_active' | 'policy_notes'>>): Promise<void> {
    const { error } = await supabase
      .from('expense_categories')
      .update({
        name: updates.name?.trim(),
        code: updates.code?.trim(),
        parent_category_id: updates.parent_category_id ?? null,
        ledger_account_code: updates.ledger_account_code ?? null,
        default_vat_treatment: updates.default_vat_treatment,
        requires_receipt: updates.requires_receipt,
        requires_approval_above: typeof updates.requires_approval_above === 'number' ? updates.requires_approval_above : null,
        is_active: updates.is_active,
        policy_notes: updates.policy_notes ?? null,
      })
      .eq('id', id);
    if (error) throw error;
    expenseCategoriesCache.invalidate();
    removeLocalCacheByPrefix('cache:expense_categories:list:');
  },

  async archiveExpenseCategory(id: string): Promise<void> {
    const { error } = await supabase
      .from('expense_categories')
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw error;
    expenseCategoriesCache.invalidate();
    removeLocalCacheByPrefix('cache:expense_categories:list:');
  },

  async getCashDailyBalances(limitDays = 30): Promise<CashDailyBalance[]> {
    const companyId = await supabaseHelpers.resolveCompanyId();
    if (!companyId) throw new Error('No company selected');
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - limitDays);
    const { data, error } = await supabase
      .from('cash_daily_balances')
      .select('*')
      .eq('company_id', companyId)
      .gte('entry_date', fromDate.toISOString().slice(0, 10))
      .order('entry_date', { ascending: false });
    if (error) throw error;
    return (data || []) as CashDailyBalance[];
  },

  async upsertCashDailyBalance(payload: {
    account_id: string;
    entry_date: string;
    opening_amount: number;
    closing_amount?: number | null;
    notes?: string | null;
  }): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    const companyId = await supabaseHelpers.resolveCompanyId();
    if (!companyId) throw new Error('No company selected');
    const difference =
      typeof payload.closing_amount === 'number' && typeof payload.opening_amount === 'number'
        ? Number((payload.closing_amount - payload.opening_amount).toFixed(2))
        : null;
    const { error } = await supabase
      .from('cash_daily_balances')
      .upsert({
        company_id: companyId,
        account_id: payload.account_id,
        entry_date: payload.entry_date,
        opening_amount: payload.opening_amount,
        closing_amount: payload.closing_amount ?? null,
        difference,
        notes: payload.notes ?? null,
        created_by: user.id,
        updated_by: user.id,
      }, { onConflict: 'company_id,account_id,entry_date' });
    if (error) throw error;
  },

  async getAccounts(): Promise<Account[]> {
    const cached = accountsCache.get();
    if (cached) return cached;
    const companyId = await supabaseHelpers.resolveCompanyId();
    const lsKey = `cache:accounts:list:${companyId || 'none'}`;
    const lsCached = readLocalCache<Account[]>(lsKey);
    if (lsCached && nowMs() - lsCached.timestamp < LOCAL_LIST_CACHE_TTL_MS) {
      const data = (lsCached.data || []) as Account[];
      accountsCache.set(data);
      return data;
    }
    const query = supabase.from('accounts').select('*').order('name', { ascending: true });
    if (companyId) query.eq('company_id', companyId);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data || []) as Account[];
    accountsCache.set(rows);
    writeLocalCache(lsKey, { data: rows });
    return rows;
  },

  async createAccount(payload: { name: string; type: AccountType; currency?: string; opening_balance?: number; linked_user_id?: string | null; notes?: string | null }): Promise<Account> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        name: payload.name.trim(),
        type: payload.type,
        currency: payload.currency || 'AED',
        opening_balance: typeof payload.opening_balance === 'number' ? payload.opening_balance : 0,
        current_balance: typeof payload.opening_balance === 'number' ? payload.opening_balance : 0,
        linked_user_id: payload.linked_user_id || null,
        notes: payload.notes || null,
        created_by: user.id,
      })
      .select('*')
      .single();
    if (error) throw error;
    accountsCache.invalidate();
    removeLocalCacheByPrefix('cache:accounts:list:');
    return data as Account;
  },

  async updateAccount(id: string, updates: Partial<Pick<Account, 'name' | 'type' | 'currency' | 'notes' | 'linked_user_id' | 'is_active'>>): Promise<void> {
    const { error } = await supabase
      .from('accounts')
      .update({
        name: updates.name?.trim(),
        type: updates.type,
        currency: updates.currency,
        notes: updates.notes ?? null,
        linked_user_id: updates.linked_user_id ?? null,
        is_active: updates.is_active,
      })
      .eq('id', id);
    if (error) throw error;
    accountsCache.invalidate();
    removeLocalCacheByPrefix('cache:accounts:list:');
  },

  async archiveAccount(id: string): Promise<void> {
    const { error } = await supabase
      .from('accounts')
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw error;
    accountsCache.invalidate();
    removeLocalCacheByPrefix('cache:accounts:list:');
  },

  async getExpensesPage(page: number, pageSize: number, filters?: ExpensePageFilters): Promise<{ data: Expense[]; total: number }> {
    const companyId = await supabaseHelpers.resolveCompanyId();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const normalized = normalizeExpenseFilters(filters);
    const filtersKey = JSON.stringify(normalized);
    const key = expensePageCacheKey(page, pageSize, filtersKey);
    const cached = getExpensePageCache(key);
    if (cached) return cached;
    const lsKey = `cache:expenses:page:${companyId}:${key}`;
    const lsCached = readLocalCache<Expense[]>(lsKey);
    if (lsCached && nowMs() - lsCached.timestamp < LOCAL_PAGE_CACHE_TTL_MS) {
      const payload = { data: (lsCached.data || []) as Expense[], total: Number((lsCached as any).total) || 0 };
      setExpensePageCache(key, payload);
      return payload;
    }
    let query = supabase
      .from('expenses')
      .select('*', { count: 'planned' })
      .range(from, to);
    if (companyId) {
      query = query.eq('company_id', companyId);
    }
    query = applyExpenseFilters(query, normalized);
    const { data, error, count } = await query;
    if (error) throw error;
    const payload = { data: (data || []) as Expense[], total: count || 0 };
    setExpensePageCache(key, payload);
    writeLocalCache(lsKey, payload);
    return payload;
  },

  async getExpenseById(id: string): Promise<Expense | null> {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data || null) as Expense | null;
  },

  async createExpense(payload: {
    expense_date: string;
    vendor_id?: string | null;
    category_id?: string | null;
    gross_amount: number;
    net_amount: number;
    vat_amount?: number;
    vat_rate?: number;
    vat_recoverable?: boolean;
    vat_input_type?: ExpenseVatInputType | null;
    vat_treatment?: ExpenseVatTreatment | null;
    recoverable_vat_amount?: number | null;
    non_recoverable_vat_amount?: number | null;
    currency?: string;
    category?: string;
    subcategory?: string;
    business_purpose?: string;
    project_id?: string | null;
    cost_center_id?: string | null;
    account_id?: string | null;
    paid_by: 'company' | 'employee';
    is_reimbursable?: boolean | null;
    employee_user_id?: string | null;
    reimbursement_status?: ExpenseReimbursementStatus;
    approval_status?: ExpenseApprovalStatus;
    receipt_id?: string | null;
    receipt_url?: string | null;
    has_receipt?: boolean | null;
    receipt_lost?: boolean | null;
    is_backfilled?: boolean;
    period_year?: number;
    period_month?: number;
  }): Promise<Expense> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    const periodDate = payload.expense_date ? new Date(payload.expense_date) : new Date();
    const period_year = payload.period_year || periodDate.getFullYear();
    const period_month = payload.period_month || periodDate.getMonth() + 1;
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        expense_date: payload.expense_date,
        submission_date: new Date().toISOString().slice(0, 10),
        vendor_id: payload.vendor_id || null,
        category_id: payload.category_id || null,
        gross_amount: payload.gross_amount,
        net_amount: payload.net_amount,
        vat_amount: payload.vat_amount ?? 0,
        vat_rate: payload.vat_rate ?? 0,
        vat_recoverable: payload.vat_recoverable ?? true,
        vat_input_type: payload.vat_input_type ?? null,
        vat_treatment: payload.vat_treatment ?? null,
        recoverable_vat_amount: typeof payload.recoverable_vat_amount === 'number' ? payload.recoverable_vat_amount : null,
        non_recoverable_vat_amount: typeof payload.non_recoverable_vat_amount === 'number' ? payload.non_recoverable_vat_amount : null,
        currency: payload.currency || 'AED',
        category: payload.category || null,
        subcategory: payload.subcategory || null,
        business_purpose: payload.business_purpose || null,
        project_id: payload.project_id || null,
        cost_center_id: payload.cost_center_id || null,
        account_id: payload.account_id || null,
        paid_by: payload.paid_by,
        is_reimbursable: payload.is_reimbursable ?? false,
        employee_user_id: payload.employee_user_id || null,
        reimbursement_status: payload.reimbursement_status || 'not_required',
        approval_status: payload.approval_status || 'submitted',
        receipt_id: payload.receipt_id || null,
        receipt_url: payload.receipt_url ?? null,
        has_receipt: payload.has_receipt ?? false,
        receipt_lost: payload.receipt_lost ?? false,
        is_backfilled: payload.is_backfilled ?? false,
        period_year,
        period_month,
        created_by: user.id,
      })
      .select('*')
      .single();
    if (error) throw error;
    invalidateExpensePagesCache();
    return data as Expense;
  },

  async updateExpense(id: string, updates: Partial<Omit<Expense, 'id' | 'company_id' | 'created_at' | 'updated_at'>>): Promise<void> {
    const patch: Record<string, any> = {};
    const hasKey = (key: keyof Expense) => Object.prototype.hasOwnProperty.call(updates, key);
    const normalizeOptional = <T>(value: T | null | undefined) => (value === undefined ? undefined : value ?? null);
    const applyField = (key: keyof Expense, value: any) => {
      if (hasKey(key) && value !== undefined) {
        patch[key as string] = value;
      }
    };

    applyField('expense_date', updates.expense_date);
    applyField('vendor_id', normalizeOptional(updates.vendor_id));
    applyField('gross_amount', updates.gross_amount);
    applyField('net_amount', updates.net_amount);
    applyField('vat_amount', updates.vat_amount);
    applyField('vat_rate', updates.vat_rate);
    applyField('vat_recoverable', updates.vat_recoverable);
    applyField('vat_input_type', normalizeOptional(updates.vat_input_type));
    applyField('vat_treatment', normalizeOptional(updates.vat_treatment));
    applyField('recoverable_vat_amount', updates.recoverable_vat_amount);
    applyField('non_recoverable_vat_amount', updates.non_recoverable_vat_amount);
    applyField('currency', updates.currency);
    applyField('category_id', normalizeOptional(updates.category_id));
    applyField('category', normalizeOptional(updates.category));
    applyField('subcategory', normalizeOptional(updates.subcategory));
    applyField('business_purpose', normalizeOptional(updates.business_purpose));
    applyField('project_id', normalizeOptional(updates.project_id));
    applyField('cost_center_id', normalizeOptional(updates.cost_center_id));
    applyField('account_id', normalizeOptional(updates.account_id));
    applyField('paid_by', updates.paid_by);
    applyField('is_reimbursable', updates.is_reimbursable);
    applyField('employee_user_id', normalizeOptional(updates.employee_user_id));
    applyField('reimbursement_status', updates.reimbursement_status);
    applyField('approval_status', updates.approval_status);
    applyField('receipt_id', normalizeOptional(updates.receipt_id));
    applyField('receipt_url', normalizeOptional(updates.receipt_url));
    applyField('has_receipt', updates.has_receipt);
    applyField('receipt_lost', updates.receipt_lost);
    applyField('ocr_data', normalizeOptional(updates.ocr_data));
    applyField('ocr_confidence', updates.ocr_confidence);
    applyField('is_backfilled', updates.is_backfilled);
    applyField('period_year', updates.period_year);
    applyField('period_month', updates.period_month);

    if (hasKey('expense_date') && updates.expense_date && (!hasKey('period_year') || !hasKey('period_month'))) {
      const d = new Date(updates.expense_date);
      if (!hasKey('period_year')) patch.period_year = d.getFullYear();
      if (!hasKey('period_month')) patch.period_month = d.getMonth() + 1;
    }
    if (Object.keys(patch).length === 0) return;
    const { error } = await supabase
      .from('expenses')
      .update(patch)
      .eq('id', id);
    if (error) throw error;
    invalidateExpensePagesCache();
  },

  async deleteExpense(id: string): Promise<void> {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);
    if (error) throw error;
    invalidateExpensePagesCache();
  },

  async getClientById(id: string): Promise<Client | null> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data || null) as Client | null;
  },

  async updateLiveShow(id: string, updates: Partial<Pick<LiveShow, 'show_date' | 'show_time' | 'location' | 'item_name' | 'kg' | 'people_count' | 'notes' | 'status'>>): Promise<LiveShow> {
    const { data, error } = await supabase
      .from('live_shows')
      .update({
        show_date: updates.show_date ?? null,
        show_time: updates.show_time ?? null,
        location: updates.location ?? null,
        item_name: updates.item_name ?? null,
        kg: typeof updates.kg === 'number' ? updates.kg : null,
        people_count: typeof updates.people_count === 'number' ? updates.people_count : null,
        notes: updates.notes ?? null,
        status: updates.status ?? undefined,
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    // Invalidate caches so updates reflect in lists immediately
    invalidateLiveShowsCache();
    invalidateLiveShowPagesCache();
    return data as LiveShow;
  },

  async getDeliveryProviderById(id: string): Promise<{ id: string; name: string; phone?: string; method?: string; managed?: boolean } | null> {
    const { data, error } = await supabase
      .from('delivery_providers')
      .select('id, name, phone, method, managed, price_multiplier')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  },

  async getDeliveryProviders(): Promise<DeliveryProvider[]> {
    const cached = getDeliveryProvidersCache();
    if (cached) {
      return cached;
    }
    const lsKey = 'cache:delivery_providers:list';
    const lsCached = readLocalCache<DeliveryProvider[]>(lsKey);
    if (lsCached && nowMs() - lsCached.timestamp < LOCAL_LIST_CACHE_TTL_MS) {
      const data = (lsCached.data || []) as DeliveryProvider[];
      setDeliveryProvidersCache(data);
      return data;
    }
    // Fetch from Supabase
    const { data, error } = await supabase
      .from('delivery_providers')
      .select('id, company_id, name, phone, method, managed, price_multiplier, created_at')
      .order('name', { ascending: true });
    if (error) throw error;
    const providers = (data || []) as DeliveryProvider[];
    setDeliveryProvidersCache(providers);
    writeLocalCache(lsKey, { data: providers });
    return providers;
  },

  // Delivery Provider Overrides (server-backed)
  async getDeliveryProviderOverrides(providerId: string): Promise<DeliveryProviderOverride[]> {
    const { data, error } = await supabase
      .from('delivery_provider_overrides')
      .select('id, company_id, provider_id, item_id, sku, price, created_at')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []) as DeliveryProviderOverride[];
  },

  async upsertDeliveryProviderOverrides(providerId: string, overrides: { item_id: string; sku?: string | null; price: number }[]): Promise<void> {
    // Resolve company_id from the provider row to ensure correct scoping
    const { data: provRows, error: provErr } = await supabase
      .from('delivery_providers')
      .select('company_id')
      .eq('id', providerId)
      .limit(1);
    if (provErr) throw provErr;
    const providerCompanyId = Array.isArray(provRows) && provRows.length > 0 ? (provRows[0]?.company_id as string | null) : null;
    const companyId = providerCompanyId || await supabaseHelpers.resolveCompanyId();
    if (!companyId) throw new Error('No company scope for overrides');
    const rows = overrides.map((o) => ({
      company_id: companyId,
      provider_id: providerId,
      item_id: o.item_id,
      sku: o.sku ?? null,
      price: o.price,
    }));
    const { error } = await supabase
      .from('delivery_provider_overrides')
      .upsert(rows, { onConflict: 'company_id,provider_id,item_id' })
      .select('id');
    if (error) throw error;
  },

  async deleteDeliveryProviderOverridesExcept(providerId: string, keepItemIds: string[]): Promise<void> {
    // Resolve company_id from the provider row to ensure correct scoping
    const { data: provRows, error: provErr } = await supabase
      .from('delivery_providers')
      .select('company_id')
      .eq('id', providerId)
      .limit(1);
    if (provErr) throw provErr;
    const providerCompanyId = Array.isArray(provRows) && provRows.length > 0 ? (provRows[0]?.company_id as string | null) : null;
    const companyId = providerCompanyId || await supabaseHelpers.resolveCompanyId();
    if (!companyId) throw new Error('No company scope for overrides');
    // Delete any overrides for this provider that are not in keepItemIds
    const query = supabase
      .from('delivery_provider_overrides')
      .delete()
      .eq('provider_id', providerId)
      .eq('company_id', companyId);
    if (keepItemIds.length > 0) {
      // PostgREST expects not.in.(a,b,c) format; build explicit list
      const list = `(${keepItemIds.join(',')})`;
      query.not('item_id', 'in', list);
    }
    const { error } = await query;
    if (error) throw error;
  },

  // ===== Kitchen Stopwatch Helpers =====
  async getKitchenProcessTypes(): Promise<KitchenProcessType[]> {
    const companyId = await supabaseHelpers.resolveCompanyId();
    const { data, error } = await supabase
      .from('kitchen_process_types')
      .select('id, company_id, name, standard_duration_minutes, variation_buffer_minutes, active, created_by, created_at')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []) as KitchenProcessType[];
  },

  async getCompanyUserById(userId: string): Promise<CompanyUser | null> {
    const { data, error } = await supabase
      .from('company_users')
      .select('user_id, company_id, role, display_name')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return (data as CompanyUser) || null;
  },

  async getCurrentCompanyUser(): Promise<CompanyUser | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    return await supabaseHelpers.getCompanyUserById(user.id);
  },

  async getKitchenProcessTypeByName(name: string): Promise<KitchenProcessType | null> {
    const companyId = await supabaseHelpers.resolveCompanyId();
    const { data, error } = await supabase
      .from('kitchen_process_types')
      .select('id, company_id, name, standard_duration_minutes, variation_buffer_minutes, active, created_by, created_at')
      .eq('company_id', companyId)
      .eq('name', name)
      .limit(1)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error; // ignore no rows
    return (data as KitchenProcessType) || null;
  },

  async createKitchenProcessType(payload: { name: string; standard_duration_minutes?: number; variation_buffer_minutes?: number; active?: boolean }): Promise<KitchenProcessType> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    const companyId = await supabaseHelpers.resolveCompanyId();
    const { data, error } = await supabase
      .from('kitchen_process_types')
      .insert({
        company_id: companyId,
        name: payload.name,
        standard_duration_minutes: payload.standard_duration_minutes ?? 10,
        variation_buffer_minutes: payload.variation_buffer_minutes ?? 0,
        active: payload.active ?? true,
        created_by: user.id,
      })
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data as KitchenProcessType;
  },

  async findOrCreateKitchenProcessType(params: { name: string; standard_duration_minutes?: number; variation_buffer_minutes?: number; active?: boolean }): Promise<KitchenProcessType> {
    const existing = await supabaseHelpers.getKitchenProcessTypeByName(params.name.trim());
    if (existing) return existing;
    return await supabaseHelpers.createKitchenProcessType(params);
  },

  async updateKitchenProcessType(id: string, updates: { name?: string; standard_duration_minutes?: number; variation_buffer_minutes?: number; active?: boolean }): Promise<void> {
    const companyId = await supabaseHelpers.resolveCompanyId();
    const payload: any = {};
    if (typeof updates.name === 'string') payload.name = updates.name;
    if (typeof updates.standard_duration_minutes === 'number') payload.standard_duration_minutes = updates.standard_duration_minutes;
    if (typeof updates.variation_buffer_minutes === 'number') payload.variation_buffer_minutes = updates.variation_buffer_minutes;
    if (typeof updates.active === 'boolean') payload.active = updates.active;
    // If companyId cannot be resolved (e.g., local dev without company mapping),
    // rely on RLS to scope the update by id only.
    let query = supabase.from('kitchen_process_types').update(payload).eq('id', id);
    if (companyId) {
      query = query.eq('company_id', companyId);
    }
    const { error } = await query;
    if (error) throw error;
  },

  // ===== Halwa Types & Process Map Helpers =====
  async getHalwaTypes(): Promise<HalwaType[]> {
    const companyId = await supabaseHelpers.resolveCompanyId();
    const { data, error } = await supabase
      .from('kitchen_halwa_types')
      .select('*')
      .eq('company_id', companyId)
      .order('name', { ascending: true });
    if (error) throw error;
    return (data || []) as HalwaType[];
  },

  async createHalwaType(payload: { name: string; base_process_count?: number; active?: boolean }): Promise<HalwaType> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    const companyId = await supabaseHelpers.resolveCompanyId();
    const { data, error } = await supabase
      .from('kitchen_halwa_types')
      .insert({
        company_id: companyId,
        name: payload.name,
        base_process_count: payload.base_process_count ?? 10,
        active: payload.active ?? true,
        created_by: user.id,
      })
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data as HalwaType;
  },

  async updateHalwaType(id: string, updates: { name?: string; base_process_count?: number; active?: boolean }): Promise<void> {
    const { error } = await supabase
      .from('kitchen_halwa_types')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
  },

  async deleteHalwaType(id: string): Promise<void> {
    const { error } = await supabase
      .from('kitchen_halwa_types')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getHalwaProcessMap(halwaTypeId: string): Promise<HalwaProcessMap[]> {
    const { data, error } = await supabase
      .from('kitchen_halwa_process_map')
      .select('*')
      .eq('halwa_type_id', halwaTypeId)
      .order('sequence_order', { ascending: true });
    if (error) throw error;
    return (data || []) as HalwaProcessMap[];
  },

  async upsertHalwaProcessMap(entry: { id?: string; halwa_type_id: string; process_type_id: string; sequence_order: number; additional_processes?: number }): Promise<HalwaProcessMap> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    if (entry.id) {
      const { data, error } = await supabase
        .from('kitchen_halwa_process_map')
        .update({ sequence_order: entry.sequence_order, additional_processes: entry.additional_processes ?? 0 })
        .eq('id', entry.id)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data as HalwaProcessMap;
    } else {
      const { data, error } = await supabase
        .from('kitchen_halwa_process_map')
        .insert({
          halwa_type_id: entry.halwa_type_id,
          process_type_id: entry.process_type_id,
          sequence_order: entry.sequence_order,
          additional_processes: entry.additional_processes ?? 0,
          created_by: user.id,
        })
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data as HalwaProcessMap;
    }
  },

  async deleteHalwaProcessMap(id: string): Promise<void> {
    const { error } = await supabase
      .from('kitchen_halwa_process_map')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async reorderHalwaProcessMap(halwaTypeId: string, orderedIds: string[]): Promise<void> {
    // Update sequence_order based on array position
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      const { error } = await supabase
        .from('kitchen_halwa_process_map')
        .update({ sequence_order: i + 1 })
        .eq('id', id)
        .eq('halwa_type_id', halwaTypeId);
      if (error) throw error;
    }
  },

  async precreateKitchenProcessesForBatch(batchId: string, halwaTypeIds: string[]): Promise<KitchenProcess[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    const companyId = await supabaseHelpers.resolveCompanyId();
    if (!halwaTypeIds || halwaTypeIds.length === 0) return [];
    // Fetch mappings and process types
    const { data: mappings, error: mErr } = await supabase
      .from('kitchen_halwa_process_map')
      .select('process_type_id, sequence_order')
      .in('halwa_type_id', halwaTypeIds);
    if (mErr) throw mErr;
    const uniqueSorted = Array.from(
      new Map((mappings || []).map((m: any) => [m.process_type_id, m.sequence_order])).entries()
    )
      .sort((a, b) => (a[1] as number) - (b[1] as number))
      .map(([process_type_id]) => process_type_id as string);

    const rows = uniqueSorted.map((pid) => ({
      batch_id: batchId,
      company_id: companyId!,
      process_type_id: pid,
      start_time: null,
      end_time: null,
      duration_minutes: null,
      remarks: null,
      auto_recorded: false,
      created_by: user.id,
    }));
    if (rows.length === 0) return [];
    const { data, error } = await supabase
      .from('kitchen_processes')
      .insert(rows)
      .select('*');
    if (error) throw error;
    return (data || []) as KitchenProcess[];
  },

  async startPrecreatedKitchenProcess(processId: string, options?: { remarks?: string }): Promise<KitchenProcess> {
    const startIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('kitchen_processes')
      .update({ start_time: startIso, remarks: options?.remarks ?? null, auto_recorded: true })
      .eq('id', processId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data as KitchenProcess;
  },


  async createKitchenBatch(payload: { halwa_type: string; starch_weight: number }): Promise<KitchenBatch> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    const companyId = await supabaseHelpers.resolveCompanyId();
    const cu = await supabaseHelpers.getCompanyUserById(user.id);
    const chefName = cu?.display_name || (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || user.email || undefined;
    const insertPayload: any = {
      company_id: companyId,
      halwa_type: payload.halwa_type,
      starch_weight: payload.starch_weight,
      chef_id: user.id,
      chef_name: chefName,
      start_time: new Date().toISOString(),
      status: 'in_progress',
      created_by: user.id,
    };
    // Attempt insert including chef_name; if schema lacks the column, retry without it
    let { data, error } = await supabase
      .from('kitchen_batches')
      .insert(insertPayload)
      .select('*')
      .maybeSingle();
    if (error) {
      const msg = (error as any)?.message?.toLowerCase() || '';
      const isChefNameSchemaIssue = msg.includes('chef_name') && (msg.includes('schema') || msg.includes('column'));
      if (isChefNameSchemaIssue) {
        // Remove chef_name and retry once
        const { chef_name, ...fallbackPayload } = insertPayload;
        const retry = await supabase
          .from('kitchen_batches')
          .insert(fallbackPayload)
          .select('*')
          .maybeSingle();
        if (retry.error) throw retry.error;
        const created = retry.data as KitchenBatch;
        // Invalidate paged caches since list ordering and totals may change
        invalidateKitchenBatchPagesCache();
        return created;
      }
      throw error;
    }
    const created = data as KitchenBatch;
    invalidateKitchenBatchPagesCache();
    return created;
  },

  async finishKitchenBatch(batchId: string): Promise<KitchenBatch> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    const { data: procs, error: pErr } = await supabase
      .from('kitchen_processes')
      .select('duration_minutes')
      .eq('batch_id', batchId);
    if (pErr) throw pErr;
    const total = (procs || []).reduce((acc, p: any) => acc + Number(p.duration_minutes || 0), 0);
    const { data, error } = await supabase
      .from('kitchen_batches')
      .update({ end_time: new Date().toISOString(), total_duration: total, status: 'completed' })
      .eq('id', batchId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    const updated = data as KitchenBatch;
    invalidateKitchenBatchPagesCache();
    return updated;
  },

  async getKitchenBatchesPage(page: number, pageSize: number): Promise<{ data: KitchenBatch[]; total: number }> {
    const companyId = await supabaseHelpers.resolveCompanyId();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const key = kitchenBatchPageCacheKey(page, pageSize);
    const memoryCached = getKitchenBatchPageCache(key);
    if (memoryCached) {
      return memoryCached;
    }
    const lsKey = `cache:kitchen_batches:page:${companyId}:${key}`;
    const lsCached = readLocalCache<KitchenBatch[]>(lsKey);
    if (lsCached && nowMs() - lsCached.timestamp < LOCAL_PAGE_CACHE_TTL_MS) {
      const payload = { data: (lsCached.data || []) as KitchenBatch[], total: Number((lsCached as any).total) || 0 };
      setKitchenBatchPageCache(key, payload);
      return payload;
    }
    const { data, error, count } = await supabase
      .from('kitchen_batches')
      .select('*', { count: 'planned' })
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    const payload = { data: (data || []) as KitchenBatch[], total: count || 0 };
    setKitchenBatchPageCache(key, payload);
    writeLocalCache(lsKey, payload);
    return payload;
  },

  async startKitchenProcess(batchId: string, processTypeId: string, options?: { remarks?: string }): Promise<KitchenProcess> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    const companyId = await supabaseHelpers.resolveCompanyId();
    const { data, error } = await supabase
      .from('kitchen_processes')
      .insert({
        batch_id: batchId,
        company_id: companyId,
        process_type_id: processTypeId,
        start_time: new Date().toISOString(),
        remarks: options?.remarks || null,
        auto_recorded: true,
        created_by: user.id,
      })
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data as KitchenProcess;
  },

  async endKitchenProcess(processId: string, options?: { remarks?: string }): Promise<KitchenProcess> {
    const { data: proc, error: gErr } = await supabase
      .from('kitchen_processes')
      .select('id, start_time')
      .eq('id', processId)
      .maybeSingle();
    if (gErr) throw gErr;
    const start = proc?.start_time ? new Date(proc.start_time).getTime() : Date.now();
    const endIso = new Date().toISOString();
    const endMs = new Date(endIso).getTime();
    const durationMin = Math.max((endMs - start) / 60000, 0);
    const { data, error } = await supabase
      .from('kitchen_processes')
      .update({ end_time: endIso, duration_minutes: Number(durationMin.toFixed(3)), remarks: options?.remarks || null })
      .eq('id', processId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data as KitchenProcess;
  },

  async getKitchenProcessesForBatch(batchId: string): Promise<KitchenProcess[]> {
    const { data, error } = await supabase
      .from('kitchen_processes')
      .select('id, batch_id, company_id, process_type_id, start_time, end_time, duration_minutes, remarks, auto_recorded, created_by, created_at')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []) as KitchenProcess[];
  },

  async validateKitchenBatch(batchId: string): Promise<KitchenBatch> {
    // Load batch, processes, and last 3 similar batches for comparison
    const { data: batch, error: bErr } = await supabase
      .from('kitchen_batches')
      .select('*')
      .eq('id', batchId)
      .maybeSingle();
    if (bErr) throw bErr;
    const { halwa_type, starch_weight } = batch as KitchenBatch;
    const { data: procs, error: pErr } = await supabase
      .from('kitchen_processes')
      .select('process_type_id, duration_minutes')
      .eq('batch_id', batchId);
    if (pErr) throw pErr;
    const { data: types, error: tErr } = await supabase
      .from('kitchen_process_types')
      .select('id, standard_duration_minutes, variation_buffer_minutes');
    if (tErr) throw tErr;
    const typeMap = new Map(types.map((t: any) => [t.id, t]));
    let status: KitchenValidationStatus = 'good';
    for (const p of procs || []) {
      const tp = typeMap.get(p.process_type_id);
      if (!tp) continue;
      const d = Number(p.duration_minutes || 0);
      const min = Number(tp.standard_duration_minutes) - Number(tp.variation_buffer_minutes);
      const max = Number(tp.standard_duration_minutes) + Number(tp.variation_buffer_minutes);
      if (d < min || d > max) {
        status = status === 'shift_detected' ? status : 'moderate';
      }
      if (d > max * 2 || d < Math.max(min / 2, 0)) {
        status = 'shift_detected';
      }
    }
    // Compare against last 3 similar batches
    const { data: similar, error: sErr } = await supabase
      .from('kitchen_batches')
      .select('total_duration')
      .eq('halwa_type', halwa_type)
      .eq('starch_weight', starch_weight)
      .neq('id', batchId)
      .order('created_at', { ascending: false })
      .limit(3);
    if (sErr) throw sErr;
    const avg = (similar || []).reduce((a: number, b: any) => a + Number(b.total_duration || 0), 0) / Math.max((similar || []).length, 1);
    const total = Number((batch as KitchenBatch).total_duration || 0);
    if (avg && (total > avg * 1.5 || total < avg * 0.5)) {
      status = 'shift_detected';
    }
    const { data: updated, error: uErr } = await supabase
      .from('kitchen_batches')
      .update({ validation_status: status, status: 'validated' })
      .eq('id', batchId)
      .select('*')
      .maybeSingle();
    if (uErr) throw uErr;
    const res = updated as KitchenBatch;
    invalidateKitchenBatchPagesCache();
    return res;
  },

  async createDeliveryProvider(payload: { name: string; phone?: string; method?: string; managed?: boolean; price_multiplier?: number }): Promise<DeliveryProvider> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const companyId = await supabaseHelpers.resolveCompanyId();
    const insertPayload: any = {
      name: payload.name,
      phone: payload.phone ?? null,
      method: payload.method ?? null,
      managed: payload.managed ?? false,
      price_multiplier: typeof payload.price_multiplier === 'number' ? payload.price_multiplier : null,
    };
    if (companyId) insertPayload.company_id = companyId;

    const { data, error } = await supabase
      .from('delivery_providers')
      .insert(insertPayload)
      .select('id, company_id, name, phone, method, managed, price_multiplier, created_at')
      .single();
    if (error) throw error;
    invalidateDeliveryProvidersCache();
    return data as DeliveryProvider;
  },

  async updateDeliveryProvider(id: string, updates: { name?: string; phone?: string | null; method?: string | null; managed?: boolean; price_multiplier?: number | null }): Promise<void> {
    const { error } = await supabase
      .from('delivery_providers')
      .update({
        name: updates.name,
        phone: updates.phone ?? null,
        method: updates.method ?? null,
        managed: updates.managed,
        // Only update price_multiplier if provided; leave untouched if undefined
        price_multiplier: (typeof updates.price_multiplier === 'number') ? updates.price_multiplier : (updates.price_multiplier === null ? null : undefined),
      })
      .eq('id', id);
    if (error) throw error;
    invalidateDeliveryProvidersCache();
  },

  async deleteDeliveryProvider(id: string): Promise<void> {
    const { error } = await supabase
      .from('delivery_providers')
      .delete()
      .eq('id', id);
    if (error) throw error;
    invalidateDeliveryProvidersCache();
  },

  async findOrCreateDeliveryProvider(params: { name: string; phone?: string; method?: string; managed?: boolean }): Promise<{ id: string; name: string }> {
    const companyId = await supabaseHelpers.resolveCompanyId();
    // Try exact-name match within company scope if companyId available; otherwise global fallback
    const query = supabase
      .from('delivery_providers')
      .select('id, name')
      .eq('name', params.name);
    if (companyId) query.eq('company_id', companyId);
    const { data: existing, error: selErr } = await query.maybeSingle();
    if (selErr) throw selErr;
    if (existing) return existing as { id: string; name: string };

    const insertPayload: any = {
      name: params.name,
      phone: params.phone || null,
      method: params.method || null,
      managed: params.managed ?? false,
    };
    if (companyId) insertPayload.company_id = companyId;

    const { data: created, error: insErr } = await supabase
      .from('delivery_providers')
      .insert(insertPayload)
      .select('id, name')
      .single();
    if (insErr) throw insErr;
    // Ensure cached provider lists reflect the new row
    invalidateDeliveryProvidersCache();
    return created as { id: string; name: string };
  },

  async getDocuments(): Promise<Document[]> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch delivery notes for POS deliveries within a date range.
   * Uses `issue_date` to determine scheduling and only returns `delivery_note` documents
   * created via POS Delivery (`origin = 'pos_delivery'`).
   */
  async getDeliveryNotesBetween(startDate: string, endDate: string): Promise<Document[]> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('document_type', 'delivery_note')
      .eq('origin', 'pos_delivery')
      .gte('issue_date', startDate)
      .lte('issue_date', endDate)
      .order('issue_date', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []) as Document[];
  },

  // Cached variant for dashboard/table views to avoid repeated DB loads
  async getDocumentsCached(options?: { forceRefresh?: boolean }): Promise<Document[]> {
    const cached = getDocumentsCache();
    if (!options?.forceRefresh && cached) {
      return cached;
    }
    const docs = await supabaseHelpers.getDocuments();
    setDocumentsCache(docs);
    return docs;
  },

  // Paged listing: server-side filtering + pagination (Clean -> Filter -> Transform)
  async getDocumentsPage(
    page: number,
    pageSize: number,
    filters?: DocumentPageFilters
  ): Promise<{ data: Document[]; total: number }> {
    const safePage = Math.max(1, Math.floor(page || 1));
    const safePageSize = Math.max(1, Math.floor(pageSize || 10));
    const start = (safePage - 1) * safePageSize;
    const end = start + safePageSize - 1;
    const normalizedFilters = normalizeDocumentFilters(filters);
    const filtersKey = JSON.stringify(normalizedFilters);
    const key = documentPageCacheKey(safePage, safePageSize, filtersKey);
    const memoryCached = getDocumentPageCache(key);
    if (memoryCached) {
      return memoryCached;
    }
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || 'anon';
    const lsKey = `cache:documents:page:${userId}:${key}`;
    const lsCached = readLocalCache<Document[]>(lsKey);
    if (lsCached && nowMs() - lsCached.timestamp < LOCAL_PAGE_CACHE_TTL_MS) {
      const payload = { data: (lsCached.data || []) as Document[], total: Number((lsCached as any).total) || 0 };
      setDocumentPageCache(key, payload);
      return payload;
    }
    // Clean -> Filter -> Transform pattern keeps the query predictable and index-friendly
    const query = supabase
      .from('documents')
      .select('*', { count: 'exact' });

    applyDocumentFilters(query, normalizedFilters);
    query.range(start, end);

    const { data, error, count } = await query;

    if (error) throw error;
    const payload = { data: (data || []) as Document[], total: count ?? 0 };
    setDocumentPageCache(key, payload);
    writeLocalCache(lsKey, payload);
    return payload;
  },

  async getDocument(id: string): Promise<Document | null> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  // Export all documents matching filters (batches through paginated fetches)
  async getDocumentsForExport(filters?: DocumentPageFilters): Promise<Document[]> {
    const pageSize = 1000;
    let page = 1;
    const all: Document[] = [];
    // Reuse paginated fetch to keep server-side filtering identical to the dashboard
    while (true) {
      const { data, total } = await supabaseHelpers.getDocumentsPage(page, pageSize, filters);
      all.push(...data);
      const totalCount = Number.isFinite(total) ? total : Infinity;
      const reachedTotal = all.length >= totalCount;
      const lastBatch = data.length === 0 || data.length < pageSize;
      if (reachedTotal || lastBatch) break;
      page += 1;
    }
    return all;
  },

  async createDocument(documentData: Omit<Document, 'id' | 'created_at' | 'updated_at' | 'user_id'>): Promise<Document> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('documents')
      .insert({
        ...documentData,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    // Mutations invalidate cache
    invalidateDocumentsCache();
    invalidateDocumentPagesCache();
    return data;
  },

  async updateDocument(id: string, updates: Partial<Document>): Promise<void> {
    const { error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    // Mutations invalidate cache
    invalidateDocumentsCache();
    invalidateDocumentPagesCache();
  },

  async deleteDocument(id: string): Promise<void> {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (error) throw error;
    // Mutations invalidate cache
    invalidateDocumentsCache();
    invalidateDocumentPagesCache();
  },

  async getDocumentItems(documentId: string): Promise<DocumentItem[]> {
    const { data, error } = await supabase
      .from('document_items')
      .select('*')
      .eq('document_id', documentId);

    if (error) throw error;
    return data || [];
  },

  async createDocumentItem(itemData: Omit<DocumentItem, 'id' | 'created_at' | 'user_id'>): Promise<DocumentItem> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('document_items')
      .insert({
        ...itemData,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteDocumentItems(documentId: string): Promise<void> {
    const { error } = await supabase
      .from('document_items')
      .delete()
      .eq('document_id', documentId);

    if (error) throw error;
  },

  async getClients(): Promise<Client[]> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Local-storage cached variant for POS: 1-hour TTL
  async getClientsCached(options?: { forceRefresh?: boolean }): Promise<Client[]> {
    const companyId = await supabaseHelpers.resolveCompanyId();
    const key = `cache:clients:list:${companyId || 'default'}`;

    if (!options?.forceRefresh) {
      const cached = readLocalCache<Client[]>(key);
      if (cached && nowMs() - cached.timestamp < LOCAL_CLIENTS_CACHE_TTL_MS) {
        return (cached.data || []) as Client[];
      }
    }

    const clients = await supabaseHelpers.getClients();
    writeLocalCache(key, { data: clients });
    return clients;
  },

  async createClient(clientData: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'user_id'>): Promise<Client> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('clients')
      .insert({
        ...clientData,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    // Invalidate local cache so POS sees new clients immediately
    removeLocalCacheByPrefix('cache:clients:list:');
    return data;
  },

  async getClientByName(name: string): Promise<Client | null> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('name', name)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async findOrCreateClient(clientData: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'user_id'>): Promise<Client> {
    if (clientData.name) {
      const existingClient = await supabaseHelpers.getClientByName(clientData.name);
      if (existingClient) {
        return existingClient;
      }
    }
    return await supabaseHelpers.createClient(clientData);
  },

  async createPOSOrder(
    mode: 'in-store' | 'delivery',
    customer: { id?: string; name: string; phone: string; email?: string; address?: string; trn?: string; emirate?: string },
    items: Array<{ description: string; quantity: number; weight?: number; sell_by?: 'unit' | 'weight'; item_id?: string | null; unit_price: number; amount: number }>,
    options: {
      paymentMethod: 'card' | 'cash' | 'both' | 'cod' | 'transfer';
      paymentCardAmount: number;
      paymentCashAmount: number;
      deliveryFee?: number;
      deliveryProvider?: {
        name: string;
        phone?: string;
        managerPhone?: string;
        managed?: boolean;
      } | null;
      discountAmount?: number;
      issueDate?: string;
      vatExempt?: boolean;
    }
  ): Promise<Document> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    let clientId = customer.id;
    let client: Client | null = null;
    if (clientId) {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .maybeSingle();
      client = data || null;
    }
    if (!client) {
      client = await supabaseHelpers.findOrCreateClient({
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        trn: customer.trn,
        emirate: customer.emirate,
      });
    }

    const issueDate = options.issueDate || new Date().toISOString().split('T')[0];

    const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const settings = await supabaseHelpers.getCompanySettings();
    const taxRate = options.vatExempt ? 0 : (settings?.tax_rate || 0);
    const discountAmount = Math.max(0, Number(options.discountAmount || 0));
    const taxableBase = Math.max(subtotal - discountAmount, 0);
    const taxAmount = options.vatExempt ? 0 : (taxableBase * taxRate) / 100;
    const total = taxableBase + taxAmount;
    const managedForTotals = Boolean(options.deliveryProvider?.managed);
    const deliveryFeeForTotals =
      mode === 'delivery' ? (managedForTotals ? 0 : Math.max(Number(options.deliveryFee || 0), 0)) : 0;
    const grandTotal = total + deliveryFeeForTotals;

    const normalizedPaymentMethod =
      mode === 'delivery' && (options.paymentMethod === 'card' || options.paymentMethod === 'both')
        ? 'transfer'
        : options.paymentMethod;

    const paymentCardAmount =
      mode === 'in-store'
        ? Math.min(Math.max(options.paymentCardAmount || 0, 0), total)
        : 0;

    let paymentCashAmount: number;
    if (mode === 'in-store') {
      if (normalizedPaymentMethod === 'card') {
        paymentCashAmount = 0;
      } else if (normalizedPaymentMethod === 'cash') {
        paymentCashAmount = total;
      } else if (normalizedPaymentMethod === 'both') {
        paymentCashAmount = Math.max(total - paymentCardAmount, 0);
      } else {
        paymentCashAmount = Math.max(options.paymentCashAmount || 0, 0);
      }
    } else {
      // For COD on delivery, collect the grand total including delivery fee
      paymentCashAmount = normalizedPaymentMethod === 'cod' ? grandTotal : 0;
    }

    // Resolve delivery provider and fee, with managed exemption
    let deliveryProviderId: string | null = null;
    let deliveryFeeVal = 0;
    if (mode === 'delivery') {
      const managed = Boolean(options.deliveryProvider?.managed);
      deliveryFeeVal = managed ? 0 : Math.max(Number(options.deliveryFee || 0), 0);
      if (options.deliveryProvider?.name) {
        const prov = await supabaseHelpers.findOrCreateDeliveryProvider({
          name: options.deliveryProvider.name,
          phone: options.deliveryProvider.phone,
          managed: options.deliveryProvider.managed,
          method: 'external',
        });
        deliveryProviderId = prov.id;
      }
    }

    const notesSuffix = options.vatExempt ? ' (VAT Exempt)' : '';

    // Create documents
    // In-store: single invoice
    if (mode === 'in-store') {
      const invoiceNumber = await generateDocumentNumberInternal('invoice');
      const invoice = await supabaseHelpers.createDocument({
        document_type: 'invoice',
        document_number: invoiceNumber,
        client_id: client.id,
        client_name: client.name,
        client_email: client.email || '',
        client_phone: client.phone || '',
        client_address: client.address || '',
        client_trn: client.trn || '',
        client_emirate: client.emirate || '',
        issue_date: issueDate,
        subtotal,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        total,
        notes: `POS Order (in-store)${notesSuffix}`,
        terms: settings?.default_terms || '',
        status: 'paid',
        origin: 'pos_in_store',
        payment_method: normalizedPaymentMethod,
        payment_card_amount: paymentCardAmount,
        payment_cash_amount: paymentCashAmount,
        delivery_fee: 0,
        delivery_provider_id: null,
      });
      for (const item of items) {
        await supabaseHelpers.createDocumentItem({
          document_id: invoice.id,
          description: item.description,
          quantity: item.quantity,
          weight: item.weight ?? 0,
          sell_by: item.sell_by ?? 'unit',
          item_id: item.item_id ?? null,
          unit_price: item.unit_price,
          amount: item.amount,
        });
      }
      return invoice;
    }

    // Delivery: create invoice and delivery note
    const invoiceNumber = await generateDocumentNumberInternal('invoice');
    const deliveryNoteNumber = await generateDocumentNumberInternal('delivery_note');

    const invoiceTotal = mode === 'delivery' ? total + deliveryFeeVal : total;
    const invoice = await supabaseHelpers.createDocument({
      document_type: 'invoice',
      document_number: invoiceNumber,
      client_id: client.id,
      client_name: client.name,
      client_email: client.email || '',
      client_phone: client.phone || '',
      client_address: client.address || '',
      client_trn: client.trn || '',
      client_emirate: client.emirate || '',
      issue_date: issueDate,
      subtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total: invoiceTotal,
      notes: `POS Order (delivery)${notesSuffix}`,
      terms: settings?.default_terms || '',
      status: 'paid',
      origin: 'pos_delivery',
      payment_method: normalizedPaymentMethod,
      payment_card_amount: paymentCardAmount,
      payment_cash_amount: paymentCashAmount,
      // Store delivery fee on invoice for clarity; delivery note also carries it
      delivery_fee: deliveryFeeVal,
      delivery_provider_id: null,
    });
    for (const item of items) {
      await supabaseHelpers.createDocumentItem({
        document_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        weight: item.weight ?? 0,
        sell_by: item.sell_by ?? 'unit',
        item_id: item.item_id ?? null,
        unit_price: item.unit_price,
        amount: item.amount,
      });
    }

    const deliveryNote = await supabaseHelpers.createDocument({
      document_type: 'delivery_note',
      document_number: deliveryNoteNumber,
      client_id: client.id,
      client_name: client.name,
      client_email: client.email || '',
      client_phone: client.phone || '',
      client_address: client.address || '',
      client_trn: client.trn || '',
      client_emirate: client.emirate || '',
      issue_date: issueDate,
      subtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total,
      notes: `Delivery Note for POS Order`,
      terms: settings?.default_terms || '',
      status: 'sent',
      origin: 'pos_delivery',
      payment_method: normalizedPaymentMethod,
      payment_card_amount: 0,
      payment_cash_amount: 0,
      delivery_fee: deliveryFeeVal,
      delivery_provider_id: deliveryProviderId,
    });
    for (const item of items) {
      await supabaseHelpers.createDocumentItem({
        document_id: deliveryNote.id,
        description: item.description,
        quantity: item.quantity,
        weight: item.weight ?? 0,
        sell_by: item.sell_by ?? 'unit',
        item_id: item.item_id ?? null,
        unit_price: item.unit_price,
        amount: item.amount,
      });
    }

    // Return invoice (to print)
    return invoice;
  },

  async getCompanySettings(): Promise<CompanySettings | null> {
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createCompanySettings(settingsData: Omit<CompanySettings, 'id' | 'created_at' | 'updated_at' | 'user_id'>): Promise<CompanySettings> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('company_settings')
      .insert({
        ...settingsData,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateCompanySettings(id: string, updates: Partial<CompanySettings>): Promise<void> {
    const { error } = await supabase
      .from('company_settings')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  },

  // --- Items CRUD ---
  async getItems(): Promise<Item[]> {
    const cached = getItemsCache();
    if (cached) {
      return cached;
    }
    const lsKey = 'cache:items:list';
    const lsCached = readLocalCache<Item[]>(lsKey);
    if (lsCached && nowMs() - lsCached.timestamp < LOCAL_LIST_CACHE_TTL_MS) {
      const data = (lsCached.data || []) as Item[];
      setItemsCache(data);
      return data;
    }
    // Fallback to Supabase
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    const items = (data || []) as Item[];
    setItemsCache(items);
    writeLocalCache(lsKey, { data: items });
    return items;
  },

  async createItem(payload: { name: string; sku?: string | null; price: number; sell_by?: 'unit' | 'weight' }): Promise<Item> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    const { data, error } = await supabase
      .from('items')
      .insert({ name: payload.name, sku: payload.sku ?? null, price: payload.price, sell_by: payload.sell_by ?? 'unit', user_id: user.id })
      .select('*')
      .single();
    if (error) throw error;
    // Invalidate dependent caches
    invalidateItemsCache();
    return data as Item;
  },

  async updateItem(id: string, updates: { name?: string; sku?: string | null; price?: number; sell_by?: 'unit' | 'weight' }): Promise<void> {
    const { error } = await supabase
      .from('items')
      .update({ name: updates.name, sku: updates.sku ?? null, price: updates.price, sell_by: updates.sell_by })
      .eq('id', id);
    if (error) throw error;
    invalidateItemsCache();
  },

  async deleteItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', id);
    if (error) throw error;
    invalidateItemsCache();
  },
};
