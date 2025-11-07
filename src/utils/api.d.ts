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
};

export function generateReceipt(data: ReceiptPayload): Promise<string>;