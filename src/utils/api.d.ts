export type ReceiptItemPayload = {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type ReceiptPayload = {
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  receiptNo: string;
  date: string;
  paymentMethod?: string;
  items: ReceiptItemPayload[];
  subtotal?: number;
  vat?: number;
  total: number;
  paidAmount: number;
  /** Optional: choose 'print' (default) or 'pdf' */
  mode?: 'print' | 'pdf';
};

export function generateReceipt(data: ReceiptPayload): Promise<string | { printed: boolean } | { ok: true }>;