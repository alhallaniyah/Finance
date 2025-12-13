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
  companyTrn?: string;
  taxRate?: number;
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

/**
 * Generate and print a receipt using the BIXOLON Web Print SDK commands.
 * Falls back to a simple HTML preview when the SDK is unavailable.
 */
export function generateReceipt(data: ReceiptPayload): Promise<string | { printed: boolean } | { ok: true } | { fallback: string }>;
