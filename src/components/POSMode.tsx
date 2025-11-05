import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, Plus, Trash2, User, MapPin, Phone, Home, Package, Truck, Store, X } from 'lucide-react';
import { supabaseHelpers, CompanySettings, Item, DeliveryProvider as DBDeliveryProvider } from '../lib/supabaseHelpers';
import { DELIVERY_PROVIDERS } from '../data/deliveryProviders';

type POSModeProps = {
  onBack: () => void;
  onOrderSaved?: (documentId: string, options?: { print?: boolean }) => void;
};

type Product = {
  id: string;
  name: string;
  sku?: string;
  price: number;
};

type CartItem = {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

type Customer = {
  id?: string;
  name: string;
  phone: string;
  address?: string;
  emirate?: string;
};

const EMIRATES = [
  'Abu Dhabi',
  'Dubai',
  'Sharjah',
  'Ajman',
  'Umm Al Quwain',
  'Ras Al Khaimah',
  'Fujairah',
];

export default function POSMode({ onBack, onOrderSaved }: POSModeProps) {
  const [mode, setMode] = useState<'in_store' | 'delivery'>('in_store');
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'both' | 'cod' | 'transfer'>('cash');
  const [cardPaymentAmount, setCardPaymentAmount] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [providers, setProviders] = useState(DELIVERY_PROVIDERS);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [customer, setCustomer] = useState<Customer>({ name: '', phone: '', address: '', emirate: '' });
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [existingClients, setExistingClients] = useState<any[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    supabaseHelpers
      .getCompanySettings()
      .then(setCompanySettings)
      .catch((e) => console.error('Failed to load company settings', e));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const items = await supabaseHelpers.getItems();
        if (items && items.length > 0) {
          const mapped: Product[] = items.map((it: Item) => ({ id: it.id, name: it.name, sku: it.sku || undefined, price: Number(it.price || 0) }));
          setProducts(mapped);
        } else {
          setProducts([
            { id: 'p1', name: 'Custom Item A', price: 100 },
            { id: 'p2', name: 'Custom Item B', price: 250 },
            { id: 'p3', name: 'Service Fee', price: 50 },
          ]);
        }
      } catch (e) {
        console.warn('Failed to load items; using defaults', e);
        setProducts([
          { id: 'p1', name: 'Custom Item A', price: 100 },
          { id: 'p2', name: 'Custom Item B', price: 250 },
          { id: 'p3', name: 'Service Fee', price: 50 },
        ]);
      }
    })();
  }, []);

  // Load delivery providers from DB; fallback to static data if empty
  useEffect(() => {
    (async () => {
      try {
        const dbProviders = await supabaseHelpers.getDeliveryProviders();
        if (dbProviders && dbProviders.length > 0) {
          const mapped = dbProviders.map((p: DBDeliveryProvider) => ({
            id: p.id,
            name: p.name,
            phone: p.phone || '',
            managerPhone: '',
            managed: Boolean(p.managed),
          }));
          setProviders(mapped as any);
          if (!selectedProviderId) setSelectedProviderId(mapped[0].id);
          return;
        }
        // If no DB providers, ensure at least default static ones
        setProviders(DELIVERY_PROVIDERS);
        if (!selectedProviderId && DELIVERY_PROVIDERS.length > 0) setSelectedProviderId(DELIVERY_PROVIDERS[0].id);
      } catch (e) {
        console.warn('Failed to load delivery providers; using defaults', e);
        setProviders(DELIVERY_PROVIDERS);
        if (!selectedProviderId && DELIVERY_PROVIDERS.length > 0) setSelectedProviderId(DELIVERY_PROVIDERS[0].id);
      }
    })();
  }, [selectedProviderId]);

  const filteredProducts = useMemo(() => {
    const t = searchTerm.trim().toLowerCase();
    if (!t) return products;
    return products.filter((p) => (p.name + (p.sku || '')).toLowerCase().includes(t));
  }, [products, searchTerm]);

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const taxRate = Number(companySettings?.tax_rate || 0);
  const taxableBase = Math.max(subtotal - discountAmount, 0);
  const taxAmount = (taxableBase * taxRate) / 100;
  const total = taxableBase + taxAmount;
  const selectedProvider = providers.find((p) => p.id === selectedProviderId) || null;

  const cardAmount = mode === 'in_store'
    ? paymentMethod === 'card'
      ? total
      : paymentMethod === 'both'
      ? Math.max(0, Math.min(cardPaymentAmount, total))
      : 0
    : 0;

  const cashAmount = mode === 'in_store'
    ? paymentMethod === 'cash'
      ? total
      : paymentMethod === 'both'
      ? Math.max(total - cardAmount, 0)
      : 0
    : paymentMethod === 'cod'
    ? total
    : 0;

  const inStorePaymentOptions = [
    { value: 'cash' as const, label: 'Cash' },
    { value: 'card' as const, label: 'Card' },
    { value: 'both' as const, label: 'Card + Cash' },
  ];

  const deliveryPaymentOptions = [
    { value: 'cod' as const, label: 'Cash on Delivery (COD)' },
    { value: 'transfer' as const, label: 'Bank Transfer' },
  ];

  const providerManaged = Boolean(selectedProvider?.managed);


  useEffect(() => {
    if (mode === 'in_store') {
      if (paymentMethod === 'cod' || paymentMethod === 'transfer') {
        setPaymentMethod('cash');
      }
      if (deliveryFee !== 0) {
        setDeliveryFee(0);
      }
    } else {
      if (paymentMethod === 'cash' || paymentMethod === 'card' || paymentMethod === 'both') {
        setPaymentMethod('cod');
      }
      if (!selectedProviderId && providers.length > 0) {
        setSelectedProviderId(providers[0].id);
      }
  }
  }, [mode, paymentMethod, deliveryFee, selectedProviderId, providers]);

  // Managed provider exemption: force delivery fee to 0 when managed
  useEffect(() => {
    if (mode === 'delivery' && providerManaged && deliveryFee !== 0) {
      setDeliveryFee(0);
    }
  }, [mode, providerManaged, deliveryFee]);

  useEffect(() => {
    if (mode === 'in_store') {
      if (paymentMethod === 'card') {
        if (cardPaymentAmount !== total) setCardPaymentAmount(total);
      } else if (paymentMethod === 'cash') {
        if (cardPaymentAmount !== 0) setCardPaymentAmount(0);
      } else if (paymentMethod === 'both') {
        const clamped = Math.max(0, Math.min(cardPaymentAmount, total));
        if (clamped !== cardPaymentAmount) setCardPaymentAmount(clamped);
      } else if (cardPaymentAmount !== 0) {
        setCardPaymentAmount(0);
      }
    } else if (cardPaymentAmount !== 0) {
      setCardPaymentAmount(0);
    }
  }, [mode, paymentMethod, total, cardPaymentAmount]);

  function addToCart(prod: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.name === prod.name && i.unitPrice === prod.price);
      if (existing) {
        return prev.map((i) => (i === existing ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { id: crypto.randomUUID(), name: prod.name, unitPrice: prod.price, quantity: 1 }];
    });
  }

  function addCustomItem(name: string, priceStr: string, qtyStr: string) {
    const price = Number(priceStr);
    const quantity = Number(qtyStr);
    if (!name || isNaN(price) || isNaN(quantity) || price < 0 || quantity <= 0) return;
    setCart((prev) => [...prev, { id: crypto.randomUUID(), name, unitPrice: price, quantity }]);
  }

  function updateQuantity(id: string, quantity: number) {
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, quantity) } : i)));
  }

  function removeItem(id: string) {
    setCart((prev) => prev.filter((i) => i.id !== id));
  }

  function handleCardPaymentAmountChange(value: string) {
    const parsed = parseFloat(value);
    const numeric = Number.isFinite(parsed) ? parsed : 0;
    setCardPaymentAmount(numeric);
  }

  function validate(): boolean {
    if (cart.length === 0) {
      setError('Cart is empty. Please add items.');
      return false;
    }

    if (mode === 'in_store' && paymentMethod === 'both' && total > 0) {
      const clamped = Math.max(0, Math.min(cardPaymentAmount, total));
      if (clamped <= 0 || clamped >= total) {
        setError('For mixed payments, enter a card amount greater than 0 and less than the total.');
        return false;
      }
    }

    const provider = selectedProvider;
    const providerManaged = mode === 'delivery' && provider?.managed;

    if (mode === 'delivery') {
      if (!provider) {
        setError('Please select a delivery provider.');
        return false;
      }
      if (!providerManaged) {
        if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
          setError('Enter a valid delivery fee (use 0 if not applicable).');
          return false;
        }
      } else {
        if (deliveryFee !== 0) setDeliveryFee(0);
      }
    }

    if (!providerManaged) {
      if (!customer.name || !customer.phone) {
        setError('Customer name and phone are required.');
        return false;
      }
      if (mode === 'delivery') {
        if (!customer.address || !customer.emirate) {
          setError('Delivery address and emirate are required for delivery sales.');
          return false;
        }
      }
    }

    setError('');
    return true;
  }

  async function handleConfirmOrder() {
    if (!validate()) return;
    setError('');
    try {
      const posMode = mode === 'in_store' ? 'in-store' : 'delivery';
      const items = cart.map((i) => ({
        description: i.name,
        quantity: i.quantity,
        unit_price: i.unitPrice,
        amount: i.unitPrice * i.quantity,
      }));

      const provider = selectedProvider;
      const providerManaged = mode === 'delivery' && provider?.managed;
      const customerPayload = { ...customer };
      if (providerManaged) {
        if (!customerPayload.name) customerPayload.name = provider?.name || 'Managed Delivery';
        if (!customerPayload.phone) customerPayload.phone = provider?.phone || '';
      }

      const cardAmountForSave = mode === 'in_store'
        ? paymentMethod === 'card'
          ? total
          : paymentMethod === 'both'
          ? Math.max(0, Math.min(cardPaymentAmount, total))
          : 0
        : 0;

      const cashAmountForSave = mode === 'in_store'
        ? paymentMethod === 'cash'
          ? total
          : paymentMethod === 'both'
          ? Math.max(total - cardAmountForSave, 0)
          : 0
        : paymentMethod === 'cod'
        ? total
        : 0;

      const doc = await supabaseHelpers.createPOSOrder(
        posMode,
        {
          id: customerPayload.id,
          name: customerPayload.name,
          phone: customerPayload.phone,
          address: customerPayload.address,
          emirate: customerPayload.emirate,
        },
        items,
        {
          paymentMethod,
          paymentCardAmount: Number(cardAmountForSave.toFixed(2)),
          paymentCashAmount: Number(cashAmountForSave.toFixed(2)),
          deliveryFee: mode === 'delivery' ? deliveryFee : 0,
          deliveryProvider:
            mode === 'delivery' && provider
              ? {
                  name: provider.name,
                  phone: provider.phone,
                  managerPhone: provider.managerPhone,
                  managed: provider.managed,
                }
              : null,
          discountAmount: discountAmount,
        }
      );

      console.log('POS Document created:', doc);
      setCart([]);
      setCustomer({ name: '', phone: '', address: '', emirate: '' });
      setCardPaymentAmount(0);
      setDeliveryFee(0);
      if (mode === 'delivery' && providers.length > 0) {
        setSelectedProviderId(providers[0].id);
      }
      setDiscountAmount(0);
      setPaymentMethod(mode === 'in_store' ? 'cash' : 'cod');
      if (onOrderSaved) {
        onOrderSaved(doc.id, { print: true });
      } else {
        onBack();
      }
    } catch (e: any) {
      console.error('Failed to save POS order', e);
      setError(e?.message || 'Failed to save order. Please try again.');
    }
  }

  async function openCustomerModal() {
    setShowCustomerModal(true);
    if (existingClients.length === 0) {
      setClientsLoading(true);
      try {
        const clients = await supabaseHelpers.getClients();
        setExistingClients(clients);
      } catch (e) {
        console.error('Failed to load clients', e);
      } finally {
        setClientsLoading(false);
      }
    }
  }

  function selectExistingClient(c: any) {
    setCustomer({
      id: c.id,
      name: c.name || '',
      phone: c.phone || '',
      address: c.address || '',
      emirate: c.emirate || '',
    });
    setShowCustomerModal(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto p-6">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <h1 className="text-2xl font-bold text-slate-800">POS Mode</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('in_store')}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${
                mode === 'in_store' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              <Store className="w-4 h-4" /> In-Store Sale
            </button>
            <button
              onClick={() => setMode('delivery')}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${
                mode === 'delivery' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              <Truck className="w-4 h-4" /> Delivery Sale
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Product Entry */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Product Entry</h2>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search items by name or SKU"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="text-left p-4 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-slate-800">{p.name}</p>
                    {p.sku && <p className="text-xs text-slate-500">SKU: {p.sku}</p>}
                  </div>
                  <span className="text-slate-700">{p.price.toFixed(2)}</span>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <div className="text-sm text-slate-500">No items found</div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Quick Add Custom Item</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  id="pos-custom-name"
                  type="text"
                  placeholder="Item description"
                  className="px-3 py-2 border border-slate-200 rounded-lg"
                />
                <input
                  id="pos-custom-price"
                  type="number"
                  placeholder="Unit price"
                  className="px-3 py-2 border border-slate-200 rounded-lg"
                />
                <input
                  id="pos-custom-qty"
                  type="number"
                  placeholder="Qty"
                  className="px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <button
                onClick={() => {
                  const name = (document.getElementById('pos-custom-name') as HTMLInputElement)?.value || '';
                  const price = (document.getElementById('pos-custom-price') as HTMLInputElement)?.value || '';
                  const qty = (document.getElementById('pos-custom-qty') as HTMLInputElement)?.value || '';
                  addCustomItem(name, price, qty);
                }}
                className="mt-3 inline-flex items-center gap-2 px-3 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900"
              >
                <Plus className="w-4 h-4" /> Add to Cart
              </button>
            </div>
          </div>

          {/* Right Panel - Order Cart */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Order Cart</h2>

            <div className="space-y-3 mb-4">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 border border-slate-200 rounded-lg p-3">
                  <div>
                    <p className="font-medium text-slate-800">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.unitPrice.toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                      className="w-20 px-3 py-2 border border-slate-200 rounded-lg"
                    />
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4 text-slate-700" />
                    </button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && <div className="text-sm text-slate-500">No items in cart</div>}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <p className="text-slate-600 font-medium">Subtotal</p>
              <p className="text-slate-800 font-bold">{subtotal.toFixed(2)}</p>
            </div>
            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-slate-600 mt-2">
                <p>Discount</p>
                <p>-{discountAmount.toFixed(2)}</p>
              </div>
            )}
            {taxRate > 0 && (
              <div className="flex items-center justify-between text-slate-600 mt-2">
                <p>Tax ({taxRate}% )</p>
                <p>{taxAmount.toFixed(2)}</p>
              </div>
            )}
            <div className="flex items-center justify-between text-slate-800 font-semibold mt-2">
              <p>Total</p>
              <p>{total.toFixed(2)}</p>
            </div>
            <div className="mt-3">
              <button
                onClick={() => {
                  const input = prompt('Enter discount amount');
                  if (input === null) return;
                  const parsed = parseFloat(input);
                  const val = Number.isFinite(parsed) ? parsed : 0;
                  const clamped = Math.max(0, Math.min(val, subtotal));
                  setDiscountAmount(clamped);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Set Discount
              </button>
            </div>

            <div className="border-t border-slate-200 pt-4 mt-4 mb-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Payment & Delivery</h3>
              {mode === 'in_store' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as any)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {inStorePaymentOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {paymentMethod === 'both' && (
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Card Amount</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={cardPaymentAmount.toFixed(2)}
                          onChange={(e) => handleCardPaymentAmountChange(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
                      <p className="text-xs text-slate-500 mb-1">Card Amount</p>
                      <p className="text-sm font-semibold text-slate-800">{cardAmount.toFixed(2)}</p>
                    </div>
                    <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
                      <p className="text-xs text-slate-500 mb-1">Cash Amount</p>
                      <p className="text-sm font-semibold text-slate-800">{cashAmount.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as any)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {deliveryPaymentOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Delivery Fee (Reference)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={deliveryFee}
                        onChange={(e) => {
                          const parsed = parseFloat(e.target.value);
                          setDeliveryFee(Number.isFinite(parsed) ? parsed : 0);
                        }}
                        disabled={providerManaged}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {providerManaged && (
                        <p className="text-xs text-emerald-600 mt-1">Managed provider: delivery fee is exempt.</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Delivery Provider</label>
                    <select
                      value={selectedProviderId}
                      onChange={(e) => setSelectedProviderId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {providers.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
                    {selectedProvider ? (
                      <>
                        <p className="text-sm font-semibold text-slate-800">{selectedProvider.name}</p>
                        <p className="text-xs text-slate-500">Phone: {selectedProvider.phone}</p>
                        <p className="text-xs text-slate-500">Manager: {selectedProvider.managerPhone}</p>
                        <span
                          className={`mt-2 inline-flex px-2 py-1 rounded-full text-[11px] font-medium ${
                            providerManaged ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {providerManaged ? 'Managed Provider' : 'Unmanaged Provider'}
                        </span>
                        {providerManaged && (
                          <p className="text-xs text-emerald-600 mt-2">Customer details optional for managed providers.</p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-slate-500">Select a delivery provider to view details.</p>
                    )}
                  </div>
                  {paymentMethod === 'cod' && (
                    <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
                      <p className="text-xs text-slate-500 mb-1">COD Amount</p>
                      <p className="text-sm font-semibold text-slate-800">{cashAmount.toFixed(2)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Customer Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Customer name"
                    value={customer.name}
                    onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                    className="w-full pl-9 px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    placeholder="Phone number"
                    value={customer.phone}
                    onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                    className="w-full pl-9 px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              {mode === 'delivery' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div className="relative">
                    <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Delivery address"
                      value={customer.address}
                      onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                      className="w-full pl-9 px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select
                      value={customer.emirate}
                      onChange={(e) => setCustomer({ ...customer, emirate: e.target.value })}
                      className="w-full pl-9 px-3 py-2 border border-slate-200 rounded-lg"
                    >
                      <option value="">Select Emirate</option>
                      {EMIRATES.map((e) => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={openCustomerModal}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  <User className="w-4 h-4" /> Select Existing Customer
                </button>
                <button
                  onClick={handleConfirmOrder}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  <Package className="w-4 h-4" /> Confirm Order
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Modal */}
        {showCustomerModal && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white w-[90vw] max-w-2xl rounded-xl shadow-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Select Customer</h3>
                <button onClick={() => setShowCustomerModal(false)} className="p-2 hover:bg-slate-50 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {clientsLoading ? (
                <div className="p-6 text-center text-slate-500">Loading customers...</div>
              ) : (
                <div className="max-h-80 overflow-auto divide-y divide-slate-200">
                  {existingClients.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => selectExistingClient(c)}
                      className="w-full text-left p-3 hover:bg-slate-50"
                    >
                      <p className="font-medium text-slate-800">{c.name || 'Unnamed'}</p>
                      <p className="text-xs text-slate-500">{c.phone || 'No phone'}</p>
                    </button>
                  ))}
                  {existingClients.length === 0 && (
                    <div className="p-6 text-center text-slate-500">No customers found</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}