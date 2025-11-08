import { supabase } from './supabase';

// Lightweight in-memory cache for dashboard documents
let documentsCache: { data: Document[]; timestamp: number } | null = null;
const DOCUMENTS_CACHE_TTL_MS = 60_000; // 60 seconds

function nowMs() {
  return Date.now();
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

export const supabaseHelpers = {
  async resolveCompanyId(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    // Try company_users first
    const { data: cu } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (cu?.company_id) return cu.company_id as string;
    // Fallback to company_settings
    const { data: cs } = await supabase
      .from('company_settings')
      .select('company_id')
      .eq('user_id', user.id)
      .maybeSingle();
    return (cs?.company_id as string) || null;
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

  async getDeliveryProviderById(id: string): Promise<{ id: string; name: string; phone?: string; method?: string; managed?: boolean } | null> {
    const { data, error } = await supabase
      .from('delivery_providers')
      .select('id, name, phone, method, managed')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  },

  async getDeliveryProviders(): Promise<DeliveryProvider[]> {
    const { data, error } = await supabase
      .from('delivery_providers')
      .select('id, company_id, name, phone, method, managed, created_at')
      .order('name', { ascending: true });
    if (error) throw error;
    return (data || []) as DeliveryProvider[];
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
        return retry.data as KitchenBatch;
      }
      throw error;
    }
    return data as KitchenBatch;
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
    return data as KitchenBatch;
  },

  async getKitchenBatchesPage(page: number, pageSize: number): Promise<{ data: KitchenBatch[]; total: number }> {
    const companyId = await supabaseHelpers.resolveCompanyId();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await supabase
      .from('kitchen_batches')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    return { data: (data || []) as KitchenBatch[], total: count || 0 };
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
    return updated as KitchenBatch;
  },

  async createDeliveryProvider(payload: { name: string; phone?: string; method?: string; managed?: boolean }): Promise<DeliveryProvider> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const companyId = await supabaseHelpers.resolveCompanyId();
    const insertPayload: any = {
      name: payload.name,
      phone: payload.phone ?? null,
      method: payload.method ?? null,
      managed: payload.managed ?? false,
    };
    if (companyId) insertPayload.company_id = companyId;

    const { data, error } = await supabase
      .from('delivery_providers')
      .insert(insertPayload)
      .select('id, company_id, name, phone, method, managed, created_at')
      .single();
    if (error) throw error;
    return data as DeliveryProvider;
  },

  async updateDeliveryProvider(id: string, updates: { name?: string; phone?: string | null; method?: string | null; managed?: boolean }): Promise<void> {
    const { error } = await supabase
      .from('delivery_providers')
      .update({
        name: updates.name,
        phone: updates.phone ?? null,
        method: updates.method ?? null,
        managed: updates.managed,
      })
      .eq('id', id);
    if (error) throw error;
  },

  async deleteDeliveryProvider(id: string): Promise<void> {
    const { error } = await supabase
      .from('delivery_providers')
      .delete()
      .eq('id', id);
    if (error) throw error;
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
    const { data, error, count } = await supabase
      .from('documents')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(start, end);

    if (error) throw error;
    return { data: (data || []) as Document[], total: count ?? 0 };
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
  },

  async deleteDocument(id: string): Promise<void> {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (error) throw error;
    // Mutations invalidate cache
    invalidateDocumentsCache();
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

    const issueDate = new Date().toISOString().split('T')[0];

    const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const settings = await supabaseHelpers.getCompanySettings();
    const taxRate = settings?.tax_rate || 0;
    const discountAmount = Math.max(0, Number(options.discountAmount || 0));
    const taxableBase = Math.max(subtotal - discountAmount, 0);
    const taxAmount = (taxableBase * taxRate) / 100;
    const total = taxableBase + taxAmount;

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
      paymentCashAmount = normalizedPaymentMethod === 'cod' ? total : 0;
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
      notes: `POS Order (delivery)`,
      terms: settings?.default_terms || '',
      status: 'paid',
      origin: 'pos_delivery',
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
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
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
    return data as Item;
  },

  async updateItem(id: string, updates: { name?: string; sku?: string | null; price?: number; sell_by?: 'unit' | 'weight' }): Promise<void> {
    const { error } = await supabase
      .from('items')
      .update({ name: updates.name, sku: updates.sku ?? null, price: updates.price, sell_by: updates.sell_by })
      .eq('id', id);
    if (error) throw error;
  },

  async deleteItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
