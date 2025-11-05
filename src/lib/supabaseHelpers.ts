import { supabase } from './supabase';

export type Client = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  trn?: string;
  created_at?: string;
  updated_at?: string;
  user_id: string;
};

export type Document = {
  id: string;
  document_type: string;
  document_number: string;
  client_id?: string;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  client_address?: string;
  client_trn?: string;
  issue_date?: string;
  due_date?: string;
  subtotal?: number;
  tax_amount?: number;
  discount_amount?: number;
  total?: number;
  notes?: string;
  terms?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  user_id: string;
};

export type DocumentItem = {
  id: string;
  document_id?: string;
  description: string;
  quantity?: number;
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

export const supabaseHelpers = {
  async getDocuments(): Promise<Document[]> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
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
};
