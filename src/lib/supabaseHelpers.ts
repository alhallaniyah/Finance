import { supabase } from './supabase';

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
    return data;
  },

  async updateDocument(id: string, updates: Partial<Document>): Promise<void> {
    const { error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  },

  async deleteDocument(id: string): Promise<void> {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (error) throw error;
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
