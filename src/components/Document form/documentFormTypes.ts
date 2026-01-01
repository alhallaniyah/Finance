export type FormItem = {
  id: string;
  description: string;
  quantity: number;
  weight: number;
  sell_by: 'unit' | 'weight';
  unit_price: number;
  amount: number;
};

export const allowedStatuses = ['draft', 'sent', 'paid', 'cancelled'] as const;
export type Status = typeof allowedStatuses[number];

export const emirateOptions = [
  'Abu Dhabi',
  'Dubai',
  'Sharjah',
  'Ajman',
  'Umm Al Quwain',
  'Ras Al Khaimah',
  'Fujairah',
] as const;

export const originLabels = {
  dashboard: 'Dashboard',
  pos_in_store: 'POS In-Store',
  pos_delivery: 'POS Delivery',
} as const;

export const invoicePaymentOptions = [
  { value: 'cash' as const, label: 'Cash' },
  { value: 'card' as const, label: 'Card' },
  { value: 'both' as const, label: 'Card + Cash' },
];

export const deliveryPaymentOptions = [
  { value: 'cod' as const, label: 'Cash on Delivery (COD)' },
  { value: 'transfer' as const, label: 'Bank Transfer' },
];

export function documentTypeLabel(type: 'quotation' | 'invoice' | 'delivery_note'): string {
  return type === 'invoice' ? 'tax receipt' : type.replace('_', ' ');
}
