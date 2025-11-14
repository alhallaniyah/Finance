export type DeliveryPriceOverride = {
  itemId?: string;
  sku?: string;
  price: number;
};

export type DeliveryProviderOption = {
  id: string;
  name: string;
  phone: string;
  managerPhone: string;
  managed: boolean;
  // Optional pricing controls for managed providers/platforms
  // If set, product prices shown in POS will be adjusted accordingly
  priceMultiplier?: number; // e.g., 1.10 for +10%
  priceOverrides?: DeliveryPriceOverride[]; // per-item overrides
};

export const DELIVERY_PROVIDERS: DeliveryProviderOption[] = [
  {
    id: 'jeebly',
    name: 'Jeebly',
    phone: '+971-4-123-4567',
    managerPhone: '+971-50-111-2223',
    managed: false,
  },
  {
    id: 'keeta',
    name: 'Keeta',
    phone: '+971-4-765-4321',
    managerPhone: '+971-50-333-4445',
    managed: false,
  },
  {
    id: 'talabat',
    name: 'Talabat',
    phone: '+971-4-555-6677',
    managerPhone: '+971-50-555-6667',
    managed: false,
    // Pricing is user-configurable; no hardcoded multiplier or overrides.
  },
  {
    id: 'porter',
    name: 'Porter',
    phone: '+971-4-222-8899',
    managerPhone: '+971-50-777-8889',
    managed: false,
  },
  {
    id: 'private_driver',
    name: 'Private Driver',
    phone: '+971-50-999-0001',
    managerPhone: '+971-50-999-0002',
    managed: true,
  },
];
