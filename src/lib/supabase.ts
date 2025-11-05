import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Document = {
  id: string;
  document_type: 'quotation' | 'invoice' | 'delivery_note';
  document_number: string;
  client_id?: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  client_address: string;
  client_trn: string;
  client_emirate?: string;
  issue_date: string;
  due_date?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  notes: string;
  terms: string;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  origin?: 'dashboard' | 'pos_in_store' | 'pos_delivery';
  payment_method?: 'cash' | 'card' | 'both' | 'cod' | 'transfer';
  payment_card_amount?: number;
  payment_cash_amount?: number;
  delivery_fee?: number;
  delivery_provider_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentItem = {
  id: string;
  document_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  created_at: string;
};

export type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  emirate?: string;
  trn: string;
  created_at: string;
  updated_at: string;
};

export type CompanySettings = {
  id: string;
  company_name: string;
  company_address: string;
  company_trn: string;
  company_logo_url: string;
  default_terms: string;
  tax_rate: number;
  created_at: string;
  updated_at: string;
};
