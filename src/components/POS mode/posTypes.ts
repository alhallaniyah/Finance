export type Product = {
  id: string;
  name: string;
  sku?: string;
  price: number;
  sell_by?: 'unit' | 'weight';
};

export type CartItem = {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  weight?: number;
  sell_by?: 'unit' | 'weight';
  itemId?: string;
};

export type Customer = {
  id?: string;
  name: string;
  phone: string;
  address?: string;
  emirate?: string;
};

export const EMIRATES = [
  'Abu Dhabi',
  'Dubai',
  'Sharjah',
  'Ajman',
  'Umm Al Quwain',
  'Ras Al Khaimah',
  'Fujairah',
];
