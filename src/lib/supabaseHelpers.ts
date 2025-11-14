import { supabase } from './supabase';

// Lightweight in-memory cache for dashboard documents
let documentsCache: { data: Document[]; timestamp: number } | null = null;
const DOCUMENTS_CACHE_TTL_MS = 60_000; // 60 seconds

// Paged cache for dashboard documents
const documentPagesCache: Map<string, { data: Document[]; total: number; timestamp: number }> = new Map();
const DOCUMENT_PAGES_CACHE_TTL_MS = 60_000; // 60 seconds

// Paged cache for kitchen batches
const kitchenBatchPagesCache: Map<string, { data: KitchenBatch[]; total: number; timestamp: number }> = new Map();
const KITCHEN_PAGES_CACHE_TTL_MS = 60_000; // 60 seconds

// Paged cache for live shows
const liveShowPagesCache: Map<string, { data: LiveShow[]; total: number; timestamp: number }> = new Map();
const LIVE_SHOW_PAGES_CACHE_TTL_MS = 60_000; // 60 seconds

// Cache for catalog items and delivery providers (used by Dashboard/Admin/POS)
 let itemsCache: { data: Item[]; timestamp: number } | null = null;
 let deliveryProvidersCache: { data: DeliveryProvider[]; timestamp: number } | null = null;
 let liveShowsCache: { data: LiveShow[]; timestamp: number } | null = null;
const LIST_CACHE_TTL_MS = 60_000; // 60 seconds

// LocalStorage TTLs (longer-lived than in-memory)
const LOCAL_LIST_CACHE_TTL_MS = 15 * 60_000; // 15 minutes
const LOCAL_PAGE_CACHE_TTL_MS = 15 * 60_000; // 15 minutes
const LOCAL_CLIENTS_CACHE_TTL_MS = 60 * 60_000; // 60 minutes (frequently used in POS)

function nowMs() {
  return Date.now();
}

// ---- localStorage helpers ----
type CachedPayload<T = any> = { data: T; timestamp: number } & Record<string, any>;

function lsGet<T = any>(key: string): CachedPayload<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.timestamp !== 'number') return null;
    return parsed as CachedPayload<T>;
  } catch {
    return null;
  }
}

function lsSet(key: string, payload: any) {
  try {
    const withTs = { ...payload, timestamp: nowMs() };
    localStorage.setItem(key, JSON.stringify(withTs));
  } catch {
    // ignore storage write errors (e.g., privacy mode)
  }
}

function lsRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function lsRemoveByPrefix(prefix: string) {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) keys.push(k);
    }
    for (const k of keys) {
      if (k.startsWith(prefix)) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    // ignore
  }
}

function isDocumentsCacheValid() {
  return documentsCache !== null && nowMs() - documentsCache.timestamp < DOCUMENTS_CACHE_TTL_MS;
}

function setDocumentsCache(data: Document[]) {
  documentsCache = { data, timestamp: nowMs() };
}

function invalidateDocumentsCache() {
  documentsCache = null;
}

function documentPageCacheKey(page: number, pageSize: number) {
  return `${page}:${pageSize}`;
}

function isDocumentPageCacheValid(key: string) {
  const entry = documentPagesCache.get(key);
  return !!entry && nowMs() - entry.timestamp < DOCUMENT_PAGES_CACHE_TTL_MS;
}

function setDocumentPageCache(key: string, payload: { data: Document[]; total: number }) {
  documentPagesCache.set(key, { ...payload, timestamp: nowMs() });
}

function invalidateDocumentPagesCache() {
  documentPagesCache.clear();
  // also clear persisted cache
  lsRemoveByPrefix('cache:documents:page:');
}

function kitchenBatchPageCacheKey(page: number, pageSize: number) {
  return `${page}:${pageSize}`;
}

function isKitchenBatchPageCacheValid(key: string) {
  const entry = kitchenBatchPagesCache.get(key);
  return !!entry && nowMs() - entry.timestamp < KITCHEN_PAGES_CACHE_TTL_MS;
}

function setKitchenBatchPageCache(key: string, payload: { data: KitchenBatch[]; total: number }) {
  kitchenBatchPagesCache.set(key, { ...payload, timestamp: nowMs() });
}

function invalidateKitchenBatchPagesCache() {
  kitchenBatchPagesCache.clear();
  // also clear persisted cache
  lsRemoveByPrefix('cache:kitchen_batches:page:');
}

function liveShowPageCacheKey(page: number, pageSize: number) {
  return `${page}:${pageSize}`;
}

function isLiveShowPageCacheValid(key: string) {
  const entry = liveShowPagesCache.get(key);
  return !!entry && nowMs() - entry.timestamp < LIVE_SHOW_PAGES_CACHE_TTL_MS;
}

function setLiveShowPageCache(key: string, payload: { data: LiveShow[]; total: number }) {
  liveShowPagesCache.set(key, { ...payload, timestamp: nowMs() });
}

function invalidateLiveShowPagesCache() {
  liveShowPagesCache.clear();
  // also clear persisted cache
  lsRemoveByPrefix('cache:live_shows:page:');
}

function isItemsCacheValid() {
  return itemsCache !== null && nowMs() - itemsCache.timestamp < LIST_CACHE_TTL_MS;
}

function setItemsCache(data: Item[]) {
  itemsCache = { data, timestamp: nowMs() };
}

function invalidateItemsCache() {
  itemsCache = null;
  lsRemove('cache:items:list');
}

function isDeliveryProvidersCacheValid() {
  return deliveryProvidersCache !== null && nowMs() - deliveryProvidersCache.timestamp < LIST_CACHE_TTL_MS;
}

function setDeliveryProvidersCache(data: DeliveryProvider[]) {
  deliveryProvidersCache = { data, timestamp: nowMs() };
}

  function invalidateDeliveryProvidersCache() {
    deliveryProvidersCache = null;
    lsRemove('cache:delivery_providers:list');
  }

  function isLiveShowsCacheValid() {
    return !!(liveShowsCache && nowMs() - liveShowsCache.timestamp < LIST_CACHE_TTL_MS);
  }

  function setLiveShowsCache(data: LiveShow[]) {
    liveShowsCache = { data, timestamp: nowMs() };
  }

  function invalidateLiveShowsCache() {
    liveShowsCache = null;
    lsRemove('cache:live_shows:list');
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
  status?: string;
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
  company_trn?: string;
  company_logo_url?: string;
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
    // Try in-memory cache first
    if (isLiveShowsCacheValid()) {
      return liveShowsCache!.data;
    }
    // Then check localStorage
    const lsKey = 'cache:live_shows:list';
    const lsCached = lsGet<LiveShow[]>(lsKey);
    if (lsCached && nowMs() - lsCached.timestamp < LOCAL_LIST_CACHE_TTL_MS) {
      setLiveShowsCache(lsCached.data as LiveShow[]);
      return lsCached.data as LiveShow[];
    }
    // Fallback to Supabase
    const { data, error } = await supabase
      .from('live_shows')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const shows = (data || []) as LiveShow[];
    setLiveShowsCache(shows);
    lsSet(lsKey, { data: shows });
    return shows;
  },

  async getLiveShowsPage(page: number, pageSize: number): Promise<{ data: LiveShow[]; total: number }> {
    const companyId = await supabaseHelpers.resolveCompanyId();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const key = liveShowPageCacheKey(page, pageSize);
    // Try in-memory cache first
    if (isLiveShowPageCacheValid(key)) {
      const cached = liveShowPagesCache.get(key)!;
      return { data: cached.data, total: cached.total };
    }
    // Then check localStorage (per company)
    const lsKey = `cache:live_shows:page:${companyId}:${key}`;
    const lsCached = lsGet<LiveShow[]>(lsKey);
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
    lsSet(lsKey, payload);
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
    // Try in-memory cache
    if (isDeliveryProvidersCacheValid()) {
      return deliveryProvidersCache!.data;
    }
    // Then check localStorage
    const lsKey = 'cache:delivery_providers:list';
    const lsCached = lsGet<DeliveryProvider[]>(lsKey);
    if (lsCached && nowMs() - lsCached.timestamp < LOCAL_LIST_CACHE_TTL_MS) {
      setDeliveryProvidersCache(lsCached.data as DeliveryProvider[]);
      return lsCached.data as DeliveryProvider[];
    }
    // Fetch from Supabase
    const { data, error } = await supabase
      .from('delivery_providers')
      .select('id, company_id, name, phone, method, managed, price_multiplier, created_at')
      .order('name', { ascending: true });
    if (error) throw error;
    const providers = (data || []) as DeliveryProvider[];
    setDeliveryProvidersCache(providers);
    lsSet(lsKey, { data: providers });
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
    // Try cache first (scoped by page+size only; filtered by company)
    const key = kitchenBatchPageCacheKey(page, pageSize);
    if (isKitchenBatchPageCacheValid(key)) {
      const cached = kitchenBatchPagesCache.get(key)!;
      return { data: cached.data, total: cached.total };
    }
    // Check localStorage next (per-company)
    const lsKey = `cache:kitchen_batches:page:${companyId}:${key}`;
    const lsCached = lsGet<KitchenBatch[]>(lsKey);
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
    lsSet(lsKey, payload);
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

  async findOrCreateDeliveryProvider(params: { name: string; phone?: string; method?: string; managed?: boolean }): Promise<{ id: string; name: string }>
  {
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
    if (!options?.forceRefresh && isDocumentsCacheValid()) {
      return documentsCache!.data;
    }
    const docs = await supabaseHelpers.getDocuments();
    setDocumentsCache(docs);
    return docs;
  },

  // Paged listing: returns a single page of documents and total count
  async getDocumentsPage(page: number, pageSize: number): Promise<{ data: Document[]; total: number }> {
    const safePage = Math.max(1, Math.floor(page || 1));
    const safePageSize = Math.max(1, Math.floor(pageSize || 10));
    const start = (safePage - 1) * safePageSize;
    const end = start + safePageSize - 1;
    // Try cache first
    const key = documentPageCacheKey(safePage, safePageSize);
    if (isDocumentPageCacheValid(key)) {
      const cached = documentPagesCache.get(key)!;
      return { data: cached.data, total: cached.total };
    }
    // Try localStorage next
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || 'anon';
    const lsKey = `cache:documents:page:${userId}:${key}`;
    const lsCached = lsGet<Document[]>(lsKey);
    if (lsCached && nowMs() - lsCached.timestamp < LOCAL_PAGE_CACHE_TTL_MS) {
      const payload = { data: (lsCached.data || []) as Document[], total: Number((lsCached as any).total) || 0 };
      setDocumentPageCache(key, payload);
      return payload;
    }
    const { data, error, count } = await supabase
      .from('documents')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(start, end);

    if (error) throw error;
    const payload = { data: (data || []) as Document[], total: count ?? 0 };
    setDocumentPageCache(key, payload);
    lsSet(lsKey, payload);
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
      const cached = lsGet<Client[]>(key);
      if (cached && nowMs() - cached.timestamp < LOCAL_CLIENTS_CACHE_TTL_MS) {
        return cached.data;
      }
    }

    const clients = await supabaseHelpers.getClients();
    lsSet(key, { data: clients, timestamp: nowMs() });
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
    lsRemoveByPrefix('cache:clients:list:');
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
    const taxRate = settings?.tax_rate || 0;
    const discountAmount = Math.max(0, Number(options.discountAmount || 0));
    const taxableBase = Math.max(subtotal - discountAmount, 0);
    const taxAmount = (taxableBase * taxRate) / 100;
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
        notes: `POS Order (in-store)`,
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
      notes: `POS Order (delivery)`,
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
    // Try in-memory cache first
    if (isItemsCacheValid()) {
      return itemsCache!.data;
    }
    // Then check localStorage
    const lsKey = 'cache:items:list';
    const lsCached = lsGet<Item[]>(lsKey);
    if (lsCached && nowMs() - lsCached.timestamp < LOCAL_LIST_CACHE_TTL_MS) {
      setItemsCache(lsCached.data as Item[]);
      return lsCached.data as Item[];
    }
    // Fallback to Supabase
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    const items = (data || []) as Item[];
    setItemsCache(items);
    lsSet(lsKey, { data: items });
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
