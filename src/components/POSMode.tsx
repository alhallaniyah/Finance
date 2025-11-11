import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, Plus, Trash2, User, MapPin, Phone, Home, Package, Truck, Store, X, Timer } from 'lucide-react';
import { supabaseHelpers, CompanySettings, Item, DeliveryProvider as DBDeliveryProvider, LiveShow, LiveShowPayment, LiveShowQuotation } from '../lib/supabaseHelpers';
import { generateDocumentNumber } from '../lib/documentHelpers';
import { DELIVERY_PROVIDERS } from '../data/deliveryProviders';

type POSModeProps = {
  onBack: () => void;
  onOrderSaved?: (documentId: string, options?: { print?: boolean }) => void;
  onOpenKitchen?: () => void;
};

type Product = {
  id: string;
  name: string;
  sku?: string;
  price: number;
  sell_by?: 'unit' | 'weight';
};

type CartItem = {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  weight?: number;
  sell_by?: 'unit' | 'weight';
  itemId?: string;
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

export default function POSMode({ onBack, onOrderSaved, onOpenKitchen }: POSModeProps) {
  const [mode, setMode] = useState<'in_store' | 'delivery' | 'live_show'>('in_store');
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
  const [userRole, setUserRole] = useState<'admin' | 'manager' | 'sales' | null>(null);

  // Live Show fields
  const [lsItemName, setLsItemName] = useState('');
  const [lsKg, setLsKg] = useState<number>(0);
  const [lsPeopleCount, setLsPeopleCount] = useState<number>(0);
  const [lsDate, setLsDate] = useState('');
  const [lsTime, setLsTime] = useState('');
  const [lsLocation, setLsLocation] = useState('');
  const [lsNotes, setLsNotes] = useState('');
  const [estimatedTotal, setEstimatedTotal] = useState(0);

  // Live Show tracking & payments
  const [liveShows, setLiveShows] = useState<LiveShow[]>([]);
  const [liveShowsLoading, setLiveShowsLoading] = useState(false);
  const [paymentsMap, setPaymentsMap] = useState<Record<string, LiveShowPayment[]>>({});
  const [quotationsMap, setQuotationsMap] = useState<Record<string, LiveShowQuotation[]>>({});
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentType, setPaymentType] = useState<'advance' | 'full'>('advance');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethodLS, setPaymentMethodLS] = useState<'cash' | 'transfer'>('cash');
  const [selectedShowForPayment, setSelectedShowForPayment] = useState<LiveShow | null>(null);

  useEffect(() => {
    supabaseHelpers
      .getCompanySettings()
      .then(setCompanySettings)
      .catch((e) => console.error('Failed to load company settings', e));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const role = await supabaseHelpers.getCurrentUserRole();
        setUserRole(role);
      } catch (e) {
        console.warn('Failed to load user role', e);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const items = await supabaseHelpers.getItems();
        if (items && items.length > 0) {
          const mapped: Product[] = items.map((it: Item) => ({ id: it.id, name: it.name, sku: it.sku || undefined, price: Number(it.price || 0), sell_by: (it.sell_by as 'unit' | 'weight') || 'unit' }));
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

  const cartSubtotal = cart.reduce((sum, item) => {
    const basis = item.sell_by === 'weight'
      ? Math.max(1, item.quantity) * (item.weight || 0)
      : item.quantity;
    return sum + item.unitPrice * basis;
  }, 0);

  const taxRate = Number(companySettings?.tax_rate || 0);
  const subtotal = mode === 'live_show' ? Math.max(0, Number(estimatedTotal || 0)) : cartSubtotal;
  const taxableBase = Math.max(subtotal - (mode === 'live_show' ? 0 : discountAmount), 0);
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

  // Load existing live shows when Live Show mode selected
  useEffect(() => {
    if (mode !== 'live_show') return;
    (async () => {
      setLiveShowsLoading(true);
      try {
        const shows = await supabaseHelpers.getLiveShows();
        setLiveShows(shows);
        const pMap: Record<string, LiveShowPayment[]> = {};
        const qMap: Record<string, LiveShowQuotation[]> = {};
        for (const s of shows) {
          try {
            pMap[s.id] = await supabaseHelpers.getLiveShowPayments(s.id);
          } catch (e) {
            pMap[s.id] = [];
          }
          try {
            qMap[s.id] = await supabaseHelpers.getLiveShowQuotations(s.id);
          } catch (e) {
            qMap[s.id] = [];
          }
        }
        setPaymentsMap(pMap);
        setQuotationsMap(qMap);
      } catch (e) {
        console.warn('Failed to load live shows', e);
      } finally {
        setLiveShowsLoading(false);
      }
    })();
  }, [mode]);

  function sumPayments(payments: LiveShowPayment[], type?: 'advance' | 'full') {
    const list = type ? payments.filter((p) => p.payment_type === type) : payments;
    return list.reduce((sum, p) => sum + Math.max(0, Number(p.amount || 0)), 0);
  }

  function openPaymentModal(show: LiveShow, type: 'advance' | 'full') {
    setSelectedShowForPayment(show);
    setPaymentType(type);
    try {
      const payments = paymentsMap[show.id] || [];
      const qs = quotationsMap[show.id] || [];
      const estimated = Math.max(0, Number(qs[0]?.total_estimated || 0));
      const adv = sumPayments(payments, 'advance');
      const full = sumPayments(payments, 'full');
      const balance = Math.max(0, estimated - (adv + full));
      setPaymentAmount(type === 'full' ? balance : 0);
    } catch {
      setPaymentAmount(0);
    }
    setPaymentMethodLS('cash');
    setShowPaymentModal(true);
  }

  async function submitLiveShowPayment() {
    if (!selectedShowForPayment) return;
    const amt = Math.max(0, Number(paymentAmount || 0));
    if (amt <= 0) {
      setError('Enter a valid payment amount greater than 0.');
      return;
    }
    try {
      // Link payment to the first quotation if present
      const qs = quotationsMap[selectedShowForPayment.id] || [];
      const q = qs.length > 0 ? qs[0] : null;
      const payment = await supabaseHelpers.recordLiveShowPayment(selectedShowForPayment.id, {
        type: paymentType,
        amount: amt,
        method: paymentMethodLS,
        quotation_id: q?.id || null,
      });

      // Create a receipt document for this payment
      const docNumber = await generateDocumentNumber('invoice');
      const issueDate = new Date().toISOString().split('T')[0];
      const clientId = selectedShowForPayment.client_id;
      const notesBase = `${paymentType === 'advance' ? 'Advance' : 'Final'} Receipt for Live Show ${selectedShowForPayment.show_number}`;
      const estimated = Math.max(0, Number(q?.total_estimated || 0));
      const advancePaid = sumPayments(paymentsMap[selectedShowForPayment.id] || [], 'advance') + (paymentType === 'advance' ? amt : 0);
      const fullPaid = sumPayments(paymentsMap[selectedShowForPayment.id] || [], 'full') + (paymentType === 'full' ? amt : 0);
      const balanceBefore = Math.max(0, estimated - (advancePaid + fullPaid - amt));
      const balanceAfter = Math.max(0, estimated - (advancePaid + fullPaid));

      const receiptDoc = await supabaseHelpers.createDocument({
        document_type: 'invoice',
        document_number: docNumber,
        client_id: clientId,
        client_name: '',
        client_email: '',
        client_phone: '',
        client_address: '',
        client_trn: '',
        client_emirate: '',
        issue_date: issueDate,
        subtotal: amt,
        tax_amount: 0,
        discount_amount: 0,
        total: amt,
        notes: `${notesBase}.\nEstimated: ${estimated.toFixed(2)}\nPaid this receipt: ${amt.toFixed(2)}\nBalance before: ${balanceBefore.toFixed(2)}\nBalance after: ${balanceAfter.toFixed(2)}`,
        terms: '',
        status: 'issued',
        origin: 'dashboard',
        delivery_fee: 0,
        delivery_provider_id: null,
      });

      // Refresh lists
      const updatedPayments = await supabaseHelpers.getLiveShowPayments(selectedShowForPayment.id);
      setPaymentsMap((prev) => ({ ...prev, [selectedShowForPayment.id]: updatedPayments }));

      setShowPaymentModal(false);
      setSelectedShowForPayment(null);
      setPaymentAmount(0);
      setPaymentMethodLS('cash');

      if (onOrderSaved) {
        onOrderSaved(receiptDoc.id, { print: true });
      }
    } catch (e: any) {
      console.error('Failed to record live show payment', e);
      setError(e?.message || 'Failed to record payment.');
    }
  }

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
      const presetSellBy: 'unit' | 'weight' = (prod.sell_by as 'unit' | 'weight') || 'unit';
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: prod.name,
          unitPrice: prod.price,
          quantity: 1,
          weight: presetSellBy === 'weight' ? 0 : undefined,
          sell_by: presetSellBy,
          itemId: prod.id,
        },
      ];
    });
  }

  const [customSellBy, setCustomSellBy] = useState<'unit' | 'weight'>('unit');

  function addCustomItem(name: string, priceStr: string, qtyStr: string, weightStr?: string) {
    const price = Number(priceStr);
    const quantity = Number(qtyStr);
    const weight = Number(weightStr || 0);
    const validQty = Number.isFinite(quantity) && quantity > 0;
    const validWeight = Number.isFinite(weight) && weight > 0;
    if (!name || isNaN(price) || price < 0) return;
    if (customSellBy === 'weight' && !validWeight) return;
    setCart((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name,
        unitPrice: price,
        quantity: validQty ? quantity : 1,
        weight: validWeight ? weight : 0,
        sell_by: customSellBy,
      },
    ]);
  }

  function updateQuantity(id: string, quantity: number) {
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, quantity) } : i)));
  }

  function updateWeight(id: string, weight: number) {
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, weight: Math.max(0, weight) } : i)));
  }

  function updateSellBy(id: string, sellBy: 'unit' | 'weight') {
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, sell_by: sellBy } : i)));
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
    if (mode !== 'live_show' && cart.length === 0) {
      setError('Cart is empty. Please add items.');
      return false;
    }

    if (mode === 'live_show') {
      const est = Number(estimatedTotal || 0);
      if (!customer.name || !customer.phone) {
        setError('Customer name and phone are required.');
        return false;
      }
      if (!Number.isFinite(est) || est <= 0) {
        setError('Enter a valid estimated total greater than 0.');
        return false;
      }
      return true;
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
      // Live Show: create quotation & live show
      if (mode === 'live_show') {
        const payload = {
          client: {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            address: customer.address,
            emirate: customer.emirate,
          },
          show_date: lsDate || undefined,
          show_time: lsTime || undefined,
          item_name: lsItemName || undefined,
          kg: typeof lsKg === 'number' ? lsKg : undefined,
          people_count: typeof lsPeopleCount === 'number' ? lsPeopleCount : undefined,
          location: lsLocation || undefined,
          notes: lsNotes || undefined,
          estimated_total: Math.max(0, Number(estimatedTotal || 0)),
        };
        const res = await supabaseHelpers.createLiveShowAndQuotation(payload);
        console.log('Live Show created:', res);
        // Reset LS-specific and customer fields
        setCart([]);
        setLsItemName('');
        setLsKg(0);
        setLsPeopleCount(0);
        setLsDate('');
        setLsTime('');
        setLsLocation('');
        setLsNotes('');
        setEstimatedTotal(0);
        setCustomer({ name: '', phone: '', address: '', emirate: '' });
        if (onOrderSaved && res.document?.id) {
          onOrderSaved(res.document.id, { print: true });
        } else {
          onBack();
        }
        return;
      }

      const posMode = mode === 'in_store' ? 'in-store' : 'delivery';
      const items = cart.map((i) => {
        const basis = i.sell_by === 'weight'
          ? Math.max(1, i.quantity) * (i.weight ?? 0)
          : i.quantity;
        return {
          description: i.name,
          quantity: i.quantity,
          weight: i.weight ?? 0,
          unit_price: i.unitPrice,
          amount: i.unitPrice * basis,
          sell_by: i.sell_by || 'unit',
          item_id: i.itemId,
        };
      });

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
        <header className="mb-6">
          <div className="flex items-center gap-3">
            {userRole === 'sales' ? (
              <button
                onClick={() => onOpenKitchen && onOpenKitchen()}
                className="inline-flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg shadow-sm hover:bg-teal-700"
                title="Go to Kitchen"
              >
                <Timer className="w-4 h-4" />
                Kitchen
              </button>
            ) : (
              <button
                onClick={onBack}
                className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <h1 className="text-2xl font-bold text-slate-800">POS Mode</h1>
          </div>
          <nav className="mt-3" aria-label="POS navigation">
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-1.5 overflow-x-auto">
              <div className="flex items-center gap-2 whitespace-nowrap">
                <button
                  onClick={() => setMode('in_store')}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium ${
                    mode === 'in_store'
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                      : 'bg-transparent text-slate-700 hover:bg-white/60 border border-transparent'
                  }`}
                  aria-current={mode === 'in_store' ? 'page' : undefined}
                >
                  <Store className="w-3.5 h-3.5" /> In-Store Sale
                </button>
                <button
                  onClick={() => setMode('delivery')}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium ${
                    mode === 'delivery'
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                      : 'bg-transparent text-slate-700 hover:bg-white/60 border border-transparent'
                  }`}
                  aria-current={mode === 'delivery' ? 'page' : undefined}
                >
                  <Truck className="w-3.5 h-3.5" /> Delivery Sale
                </button>
                <button
                  onClick={() => setMode('live_show')}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium ${
                    mode === 'live_show'
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                      : 'bg-transparent text-slate-700 hover:bg-white/60 border border-transparent'
                  }`}
                  aria-current={mode === 'live_show' ? 'page' : undefined}
                >
                  <Timer className="w-3.5 h-3.5" /> Live Show
                </button>
              </div>
            </div>
          </nav>
        </header>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Product Entry or Live Show Details */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">{mode === 'live_show' ? 'Live Show Details' : 'Product Entry'}</h2>

            {mode === 'live_show' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Item Name</label>
                    <input
                      type="text"
                      value={lsItemName}
                      onChange={(e) => setLsItemName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">KG</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={lsKg}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setLsKg(Number.isFinite(v) ? v : 0);
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">People Count</label>
                    <input
                      type="number"
                      min="0"
                      value={lsPeopleCount}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        setLsPeopleCount(Number.isFinite(v) ? v : 0);
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                    <input
                      type="date"
                      value={lsDate}
                      onChange={(e) => setLsDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Time</label>
                    <input
                      type="time"
                      value={lsTime}
                      onChange={(e) => setLsTime(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
                    <input
                      type="text"
                      value={lsLocation}
                      onChange={(e) => setLsLocation(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                  <textarea
                    rows={3}
                    value={lsNotes}
                    onChange={(e) => setLsNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Estimated Total</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={estimatedTotal}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setEstimatedTotal(Number.isFinite(v) ? v : 0);
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                  <p className="text-xs text-slate-500 mt-1">Company tax rate applies.</p>
                </div>

                {/* Existing Live Shows table for multi-stage flow */}
                <div className="border-t border-slate-200 pt-4 mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-700">Existing Live Shows</h3>
                    <button
                      onClick={async () => {
                        // Manual refresh
                        setLiveShowsLoading(true);
                        try {
                          const shows = await supabaseHelpers.getLiveShows();
                          setLiveShows(shows);
                          const pMap: Record<string, LiveShowPayment[]> = {};
                          const qMap: Record<string, LiveShowQuotation[]> = {};
                          for (const s of shows) {
                            try { pMap[s.id] = await supabaseHelpers.getLiveShowPayments(s.id); } catch { pMap[s.id] = []; }
                            try { qMap[s.id] = await supabaseHelpers.getLiveShowQuotations(s.id); } catch { qMap[s.id] = []; }
                          }
                          setPaymentsMap(pMap);
                          setQuotationsMap(qMap);
                        } finally {
                          setLiveShowsLoading(false);
                        }
                      }}
                      className="text-xs px-2 py-1 border border-slate-200 rounded hover:bg-slate-50"
                    >
                      Refresh
                    </button>
                  </div>
                  {liveShowsLoading ? (
                    <div className="text-sm text-slate-500">Loading live shows…</div>
                  ) : liveShows.length === 0 ? (
                    <div className="text-sm text-slate-500">No live shows yet</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                        <thead className="bg-slate-50 text-slate-700">
                          <tr>
                            <th className="text-left px-3 py-2 border-b">ID</th>
                            <th className="text-left px-3 py-2 border-b">Show #</th>
                            <th className="text-left px-3 py-2 border-b">Date</th>
                            <th className="text-left px-3 py-2 border-b">Time</th>
                            <th className="text-left px-3 py-2 border-b">Location</th>
                            <th className="text-left px-3 py-2 border-b">Status</th>
                            <th className="text-right px-3 py-2 border-b">Estimated</th>
                            <th className="text-right px-3 py-2 border-b">Advance Paid</th>
                            <th className="text-right px-3 py-2 border-b">Full Paid</th>
                            <th className="text-right px-3 py-2 border-b">Balance</th>
                            <th className="text-left px-3 py-2 border-b">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="text-slate-800">
                          {liveShows.map((s) => {
                            const payments = paymentsMap[s.id] || [];
                            const qs = quotationsMap[s.id] || [];
                            const estimated = Math.max(0, Number(qs[0]?.total_estimated || 0));
                            const adv = sumPayments(payments, 'advance');
                            const full = sumPayments(payments, 'full');
                            const balance = Math.max(0, estimated - (adv + full));
                            return (
                              <tr key={s.id} className="border-b last:border-b-0">
                                <td className="px-3 py-2 text-xs text-slate-500">{s.id}</td>
                                <td className="px-3 py-2 font-medium">{s.show_number}</td>
                                <td className="px-3 py-2">{s.show_date || '—'}</td>
                                <td className="px-3 py-2">{s.show_time || '—'}</td>
                                <td className="px-3 py-2">{s.location}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-1 rounded-full text-[11px] font-medium ${
                                    s.status === 'quotation' ? 'bg-yellow-100 text-yellow-700' :
                                    s.status === 'advanced_paid' ? 'bg-blue-100 text-blue-700' :
                                    s.status === 'fully_paid' ? 'bg-emerald-100 text-emerald-700' :
                                    'bg-slate-200 text-slate-700'
                                  }`}>{s.status.replace('_', ' ')}</span>
                                </td>
                                <td className="px-3 py-2 text-right">{estimated.toFixed(2)}</td>
                                <td className="px-3 py-2 text-right">{adv.toFixed(2)}</td>
                                <td className="px-3 py-2 text-right">{full.toFixed(2)}</td>
                                <td className="px-3 py-2 text-right font-semibold">{balance.toFixed(2)}</td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    {s.status === 'quotation' && (
                                      <button
                                        onClick={() => openPaymentModal(s, 'advance')}
                                        className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                                      >
                                        Record Advance
                                      </button>
                                    )}
                                    {s.status === 'advanced_paid' && (
                                      <button
                                        onClick={() => openPaymentModal(s, 'full')}
                                        className="text-xs px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                                      >
                                        Record Full Payment
                                      </button>
                                    )}
                                    {s.status === 'fully_paid' && (
                                      <span className="text-xs text-emerald-700">Completed</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
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
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-slate-600">Sell by:</span>
                    <div className="inline-flex rounded-md border border-slate-200 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setCustomSellBy('unit')}
                        className={`px-3 py-1 text-xs ${customSellBy === 'unit' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}
                      >
                        Unit
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomSellBy('weight')}
                        className={`px-3 py-1 text-xs ${customSellBy === 'weight' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}
                      >
                        Weight
                      </button>
                    </div>
                    {customSellBy === 'weight' && (
                      <div className="flex items-center gap-2 ml-2">
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById('pos-custom-weight') as HTMLInputElement;
                            if (el) el.value = '0.5';
                          }}
                          className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded"
                        >
                          0.5 kg
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById('pos-custom-weight') as HTMLInputElement;
                            if (el) el.value = '1';
                          }}
                          className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded"
                        >
                          1 kg
                        </button>
                      </div>
                    )}
                  </div>
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
                      placeholder={customSellBy === 'weight' ? 'Price per kg' : 'Unit price'}
                      className="px-3 py-2 border border-slate-200 rounded-lg"
                    />
                    <div className="flex flex-col">
                      <label htmlFor="pos-custom-qty" className="text-[10px] font-medium text-slate-600 mb-1">Quantity</label>
                      <input
                        id="pos-custom-qty"
                        type="number"
                        placeholder="Qty"
                        className="px-3 py-2 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="pos-custom-weight" className="text-[10px] font-medium text-slate-600 mb-1">Weight</label>
                      <input
                        id="pos-custom-weight"
                        type="number"
                        placeholder="kg"
                        disabled={customSellBy === 'unit'}
                        className="px-3 py-2 border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const name = (document.getElementById('pos-custom-name') as HTMLInputElement)?.value || '';
                      const price = (document.getElementById('pos-custom-price') as HTMLInputElement)?.value || '';
                      const qty = (document.getElementById('pos-custom-qty') as HTMLInputElement)?.value || '';
                      const weight = (document.getElementById('pos-custom-weight') as HTMLInputElement)?.value || '';
                      addCustomItem(name, price, qty, weight);
                    }}
                    className="mt-3 inline-flex items-center gap-2 px-3 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900"
                  >
                    <Plus className="w-4 h-4" /> Add to Cart
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Right Panel - Order Cart */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Order Cart</h2>

            <div className="space-y-3 mb-4">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 border border-slate-200 rounded-lg p-3">
                  <div>
                    <p className="font-medium text-slate-800">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.unitPrice.toFixed(2)} {item.sell_by === 'weight' ? 'per kg' : 'each'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!item.itemId ? (
                      <div className="inline-flex rounded-md border border-slate-200 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => updateSellBy(item.id, 'unit')}
                          className={`px-2 py-1 text-xs ${item.sell_by === 'unit' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}
                        >
                          Unit
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSellBy(item.id, 'weight')}
                          className={`px-2 py-1 text-xs ${item.sell_by === 'weight' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}
                        >
                          Weight
                        </button>
                      </div>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded border border-slate-200 text-slate-700">
                        {item.sell_by === 'weight' ? 'Weight' : 'Unit'}
                      </span>
                    )}
                    {item.sell_by === 'weight' && (
                      <>
                        <button
                          type="button"
                          onClick={() => updateWeight(item.id, 0.5)}
                          className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded"
                        >
                          0.5 kg
                        </button>
                        <button
                          type="button"
                          onClick={() => updateWeight(item.id, 1)}
                          className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded"
                        >
                          1 kg
                        </button>
                      </>
                    )}
                    <div className="flex flex-col items-start">
                      <label className="text-[10px] font-medium text-slate-600 mb-1">Quantity</label>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                        className="w-20 px-3 py-2 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div className="flex flex-col items-start">
                      <label className="text-[10px] font-medium text-slate-600 mb-1">Weight</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.weight ?? 0}
                        onChange={(e) => updateWeight(item.id, Number(e.target.value))}
                        className="w-24 px-3 py-2 border border-slate-200 rounded-lg"
                        disabled={item.sell_by === 'unit'}
                        placeholder="kg"
                      />
                    </div>
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
            {mode !== 'live_show' && (
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
            )}

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
              ) : mode === 'delivery' ? (
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
              ) : null}
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
                  <Package className="w-4 h-4" /> {mode === 'live_show' ? 'Create Quotation' : 'Confirm Order'}
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

        {/* Live Show Payment Modal */}
        {showPaymentModal && selectedShowForPayment && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white w-[90vw] max-w-md rounded-xl shadow-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">
                  {paymentType === 'advance' ? 'Record Advance Payment' : 'Record Full Payment'}
                </h3>
                <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-slate-50 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="text-sm text-slate-600 mb-3">
                <p className="mb-1"><span className="font-semibold">Live Show:</span> {selectedShowForPayment.show_number}</p>
                <p className="mb-1"><span className="font-semibold">Date:</span> {selectedShowForPayment.show_date || 'N/A'} at {selectedShowForPayment.show_time || 'N/A'}</p>
                <p><span className="font-semibold">Location:</span> {selectedShowForPayment.location}</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
                  <select
                    value={paymentMethodLS}
                    onChange={(e) => setPaymentMethodLS(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  >
                    <option value="cash">Cash</option>
                    <option value="transfer">Bank Transfer</option>
                  </select>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitLiveShowPayment}
                    className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                  >
                    Save & Print Receipt
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}