import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'both' | 'cod' | 'transfer' | 'provider'>('cash');
  const [cardPaymentAmount, setCardPaymentAmount] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [providers, setProviders] = useState(DELIVERY_PROVIDERS);
  const [discountAmount, setDiscountAmount] = useState(0);
  // Discount controls: amount or percentage
  const [discountType, setDiscountType] = useState<'amount' | 'percentage'>('amount');
  const [discountInput, setDiscountInput] = useState<number>(0);
  const [customer, setCustomer] = useState<Customer>({ name: '', phone: '', address: '', emirate: '' });
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [existingClients, setExistingClients] = useState<any[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [orderDate, setOrderDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [userRole, setUserRole] = useState<'admin' | 'manager' | 'sales' | null>(null);
  // Provider pricing editor state
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [pricingForm, setPricingForm] = useState<Record<string, string>>({});
  const [multiplierInput, setMultiplierInput] = useState<string>('');
  // Track if the user has started editing pricing, to avoid overwriting inputs
  const [pricingDirty, setPricingDirty] = useState(false);

  // Submission guard and loading indicator (must be inside component)
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

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
  const [lsPage, setLsPage] = useState(1);
  const LS_PAGE_SIZE = 5;
  const [lsTotal, setLsTotal] = useState(0);
  const [paymentsMap, setPaymentsMap] = useState<Record<string, LiveShowPayment[]>>({});
  const [quotationsMap, setQuotationsMap] = useState<Record<string, LiveShowQuotation[]>>({});
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentType, setPaymentType] = useState<'advance' | 'full'>('advance');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethodLS, setPaymentMethodLS] = useState<'cash' | 'transfer'>('cash');
  const [selectedShowForPayment, setSelectedShowForPayment] = useState<LiveShow | null>(null);
  const [selectedLiveShowIds, setSelectedLiveShowIds] = useState<string[]>([]);
  const [showCombinedModal, setShowCombinedModal] = useState(false);
  const [combinedPaymentMethod, setCombinedPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [combinedIssueDate, setCombinedIssueDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [combinedVatExempt, setCombinedVatExempt] = useState(false);
  const [vatExempt, setVatExempt] = useState(false);

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
          const defaultsByName = Object.fromEntries(DELIVERY_PROVIDERS.map((d) => [d.name.toLowerCase(), d]));
          const mapped = dbProviders.map((p: DBDeliveryProvider) => ({
            id: p.id,
            name: p.name,
            phone: p.phone || '',
            managerPhone: '',
            managed: Boolean(p.managed),
            // Merge optional pricing policy from static defaults by name
            priceMultiplier:
              typeof (p as any).price_multiplier === 'number'
                ? Number((p as any).price_multiplier)
                : defaultsByName[p.name.toLowerCase()]?.priceMultiplier,
            priceOverrides: defaultsByName[p.name.toLowerCase()]?.priceOverrides,
          }));
          setProviders(mapped as any);
          if (!selectedProviderId) setSelectedProviderId(mapped[0].id);
          return;
        }
        // If no DB providers, fallback to static ones without local persistence
        setProviders(DELIVERY_PROVIDERS as any);
        if (!selectedProviderId && DELIVERY_PROVIDERS.length > 0) setSelectedProviderId(DELIVERY_PROVIDERS[0].id);
      } catch (e) {
        console.warn('Failed to load delivery providers; using defaults', e);
        setProviders(DELIVERY_PROVIDERS as any);
        if (!selectedProviderId && DELIVERY_PROVIDERS.length > 0) setSelectedProviderId(DELIVERY_PROVIDERS[0].id);
      }
    })();
  }, [selectedProviderId]);

  const selectedProvider = providers.find((p) => p.id === selectedProviderId) || null;
  // Initialize pricing form whenever provider or products change
  useEffect(() => {
    if (!selectedProvider) return;
    // Load server-backed overrides for selected provider
    (async () => {
      try {
        const overrides = await supabaseHelpers.getDeliveryProviderOverrides(selectedProvider.id);
        setProviders((prev) => prev.map((p: any) => (p.id === selectedProvider.id ? { ...p, priceOverrides: overrides.map((o) => ({ itemId: o.item_id, sku: o.sku || undefined, price: o.price })) } : p)));
      } catch (e) {
        console.warn('Failed to load provider overrides from server', e);
      }
    })();
    // Only initialize inputs if user hasn't started editing
    if (!pricingDirty) {
      setMultiplierInput(
        typeof (selectedProvider as any).priceMultiplier !== 'undefined' && (selectedProvider as any).priceMultiplier !== null
          ? String(Number((selectedProvider as any).priceMultiplier))
          : ''
      );
    }
    const overrides = (selectedProvider as any).priceOverrides || [];
    const form: Record<string, string> = {};
    for (const prod of products) {
      const ov = overrides.find((o: any) => (o.itemId && o.itemId === prod.id) || (o.sku && o.sku === prod.sku));
      form[prod.id] = typeof ov?.price !== 'undefined' ? String(Number(ov.price)) : '';
    }
    if (!pricingDirty) {
      setPricingForm(form);
    }
  }, [selectedProviderId, selectedProvider, products, pricingDirty]);

  // Reset dirty state when switching providers
  useEffect(() => {
    setPricingDirty(false);
  }, [selectedProviderId]);

  const effectiveProducts = useMemo(() => {
    if (mode !== 'delivery' || !selectedProvider) return products;
    const mult = Number(selectedProvider.priceMultiplier || 0);
    const overrides = selectedProvider.priceOverrides || [];
    return products.map((p) => {
      let price = p.price;
      const ov = overrides.find((o) => (o.itemId && o.itemId === p.id) || (o.sku && o.sku === p.sku));
      if (ov) price = Number(ov.price);
      else if (mult && mult > 0) price = Number((p.price * mult).toFixed(2));
      return { ...p, price };
    });
  }, [mode, products, selectedProvider]);

  const filteredProducts = useMemo(() => {
    const t = searchTerm.trim().toLowerCase();
    const source = effectiveProducts;
    if (!t) return source;
    return source.filter((p) => (p.name + (p.sku || '')).toLowerCase().includes(t));
  }, [effectiveProducts, searchTerm]);

  const cartSubtotal = cart.reduce((sum, item) => {
    const basis = item.sell_by === 'weight'
      ? Math.max(1, item.quantity) * (item.weight || 0)
      : item.quantity;
    return sum + item.unitPrice * basis;
  }, 0);

  const taxRate = Number(companySettings?.tax_rate || 0);
  const effectiveTaxRate = vatExempt ? 0 : taxRate;
  const subtotal = mode === 'live_show' ? Math.max(0, Number(estimatedTotal || 0)) : cartSubtotal;
  const taxableBase = Math.max(subtotal - (mode === 'live_show' ? 0 : discountAmount), 0);
  const taxAmount = (taxableBase * effectiveTaxRate) / 100;
  const total = taxableBase + taxAmount + (mode === 'delivery' ? Math.max(0, Number(deliveryFee || 0)) : 0);
  // selectedProvider defined above

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
    { value: 'provider' as const, label: 'Delivery Provider' },
  ];

  const providerManaged = Boolean(selectedProvider?.managed);

  // Derive discount amount from input and type whenever cart subtotal changes or input updates
  useEffect(() => {
    if (mode === 'live_show') {
      if (discountAmount !== 0) setDiscountAmount(0);
      return;
    }
    const clampSubtotal = Math.max(0, Number(subtotal || 0));
    if (discountType === 'amount') {
      const val = Math.max(0, Number(discountInput || 0));
      const amt = Math.min(val, clampSubtotal);
      if (amt !== discountAmount) setDiscountAmount(Number(amt.toFixed(2)));
    } else {
      const pct = Math.max(0, Math.min(Number(discountInput || 0), 100));
      const amt = clampSubtotal * (pct / 100);
      if (amt !== discountAmount) setDiscountAmount(Number(amt.toFixed(2)));
    }
  }, [mode, subtotal, discountType, discountInput]);


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

  // When provider changes in delivery mode, reprice cart items based on effective products
  useEffect(() => {
    if (mode !== 'delivery') return;
    const priceMap = new Map(effectiveProducts.map((p) => [p.id, p.price]));
    setCart((prev) =>
      prev.map((i) => (i.itemId && priceMap.has(i.itemId) ? { ...i, unitPrice: priceMap.get(i.itemId)! } : i))
    );
  }, [mode, selectedProviderId, effectiveProducts]);

  // Load existing live shows when Live Show mode selected or page changes
  useEffect(() => {
    if (mode !== 'live_show') return;
    (async () => {
      await loadLiveShowsPage();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, lsPage]);

  async function loadLiveShowsPage(pageOverride?: number) {
    const pageToLoad = typeof pageOverride === 'number' ? pageOverride : lsPage;
    setLiveShowsLoading(true);
    try {
      const { data, total } = await supabaseHelpers.getLiveShowsPage(pageToLoad, LS_PAGE_SIZE);
      setLiveShows(data);
      setLsTotal(total);
      const pMap: Record<string, LiveShowPayment[]> = {};
      const qMap: Record<string, LiveShowQuotation[]> = {};
      for (const s of data) {
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
      console.warn('Failed to load live shows page', e);
    } finally {
      setLiveShowsLoading(false);
    }
  }

  async function handleDeleteLiveShow(id: string) {
    const confirmed = confirm('Delete this live show? This action cannot be undone.');
    if (!confirmed) return;
    try {
      await supabaseHelpers.deleteLiveShow(id);
      const afterTotal = Math.max(0, lsTotal - 1);
      const totalPages = Math.max(1, Math.ceil(afterTotal / LS_PAGE_SIZE));
      const nextPage = Math.min(lsPage, totalPages);
      setLsTotal(afterTotal);
      setLsPage(nextPage);
      await loadLiveShowsPage(nextPage);
    } catch (e) {
      console.error('Failed to delete live show', e);
      alert('Failed to delete live show. Please try again.');
    }
  }

  function sumPayments(payments: LiveShowPayment[], type?: 'advance' | 'full') {
    const list = type ? payments.filter((p) => p.payment_type === type) : payments;
    return list.reduce((sum, p) => sum + Math.max(0, Number(p.amount || 0)), 0);
  }

  function getLiveShowTotals(showId: string) {
    const payments = paymentsMap[showId] || [];
    const qs = quotationsMap[showId] || [];
    const estimated = Math.max(0, Number(qs[0]?.total_estimated || 0));
    const advancePaid = sumPayments(payments, 'advance');
    const fullPaid = sumPayments(payments, 'full');
    const balance = Math.max(0, estimated - (advancePaid + fullPaid));
    return { estimated, advancePaid, fullPaid, balance, quotation: qs[0] || null };
  }

  const paymentSummary = useMemo(() => {
    if (!selectedShowForPayment) return null;
    return getLiveShowTotals(selectedShowForPayment.id);
  }, [selectedShowForPayment, paymentsMap, quotationsMap]);

  function openPaymentModal(show: LiveShow, type: 'advance' | 'full') {
    setSelectedShowForPayment(show);
    setPaymentType(type);
    try {
      const totals = getLiveShowTotals(show.id);
      setPaymentAmount(type === 'full' ? totals.balance : 0);
    } catch {
      setPaymentAmount(0);
    }
    setPaymentMethodLS('cash');
    setShowPaymentModal(true);
  }

  useEffect(() => {
    // Drop selections not on the current page to avoid stale IDs
    setSelectedLiveShowIds((prev) => prev.filter((id) => liveShows.some((s) => s.id === id)));
  }, [liveShows]);

  function toggleLiveShowSelection(id: string) {
    setSelectedLiveShowIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleSelectAllLiveShows(onPageOnly: boolean = true) {
    const pageIds = liveShows.map((s) => s.id);
    const allSelected = pageIds.every((id) => selectedLiveShowIds.includes(id));
    if (allSelected) {
      setSelectedLiveShowIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedLiveShowIds((prev) =>
        Array.from(new Set([...prev, ...(onPageOnly ? pageIds : [])]))
      );
    }
  }

  const selectedLiveShows = liveShows.filter((s) => selectedLiveShowIds.includes(s.id));
  const selectedClientId = selectedLiveShows.length > 0 ? selectedLiveShows[0].client_id : null;
  const hasMixedClients = selectedLiveShows.some((s) => s.client_id !== selectedClientId);
  const selectedBalances = selectedLiveShows.map((s) => getLiveShowTotals(s.id));
  const combinedBalance = selectedBalances.reduce((sum, t) => sum + t.balance, 0);

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
      await supabaseHelpers.recordLiveShowPayment(selectedShowForPayment.id, {
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

      // Load client details for Bill To
      const client = await supabaseHelpers.getClientById(clientId);

      const receiptDoc = await supabaseHelpers.createDocument({
        document_type: 'invoice',
        document_number: docNumber,
        client_id: clientId,
        client_name: client?.name || '',
        client_email: client?.email || '',
        client_phone: client?.phone || '',
        client_address: client?.address || '',
        client_trn: (client as any)?.trn || '',
        client_emirate: client?.emirate || '',
        issue_date: issueDate,
        subtotal: amt,
        tax_amount: 0,
        discount_amount: 0,
        total: amt,
        notes: `${notesBase}.\nEstimated: ${estimated.toFixed(2)}\nPaid this receipt: ${amt.toFixed(2)}\nBalance before: ${balanceBefore.toFixed(2)}\nBalance after: ${balanceAfter.toFixed(2)}`,
        terms: '',
        status: 'issued',
        origin: 'dashboard',
        payment_method: paymentMethodLS,
        payment_card_amount: 0,
        payment_cash_amount: paymentMethodLS === 'cash' ? amt : 0,
        delivery_fee: 0,
        delivery_provider_id: null,
      });

      // Ensure receipt has an item so it displays in document view
      try {
        await supabaseHelpers.createDocumentItem({
          document_id: receiptDoc.id,
          description: `${paymentType === 'advance' ? 'Advance Payment' : 'Full Payment'} (${selectedShowForPayment.show_number})`,
          quantity: 1,
          weight: 0,
          sell_by: 'unit',
          item_id: null,
          unit_price: amt,
          amount: amt,
        });
      } catch (e) {
        console.warn('Failed to attach payment item to receipt', e);
      }

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

  function openCombinedReceiptModal() {
    if (selectedLiveShows.length < 2) {
      setError('Select at least two live shows to combine.');
      return;
    }
    if (hasMixedClients) {
      setError('Selected live shows must belong to the same customer.');
      return;
    }
    if (combinedBalance <= 0) {
      setError('Nothing to collect. All selected shows are fully paid.');
      return;
    }
    setCombinedIssueDate(new Date().toISOString().split('T')[0]);
    setCombinedPaymentMethod('cash');
    setCombinedVatExempt(vatExempt);
    setShowCombinedModal(true);
  }

  async function submitCombinedReceipt() {
    if (selectedLiveShows.length < 1 || !selectedClientId) {
      setError('Select live shows to combine.');
      return;
    }
    if (hasMixedClients) {
      setError('Selected live shows must belong to the same customer.');
      return;
    }
    const balances = selectedLiveShows.map((s) => ({ show: s, totals: getLiveShowTotals(s.id) }));
    const payable = balances.filter(({ totals }) => totals.balance > 0);
    if (payable.length === 0) {
      setError('Nothing to collect. All selected shows are fully paid.');
      return;
    }
    const subtotal = payable.reduce((sum, { totals }) => sum + totals.balance, 0);
    const taxRate = combinedVatExempt ? 0 : Number(companySettings?.tax_rate || 0);
    const taxAmount = (subtotal * taxRate) / 100;
    const totalCombined = subtotal + taxAmount;
    try {
      const client = await supabaseHelpers.getClientById(selectedClientId);
      const docNumber = await generateDocumentNumber('invoice');
      const notes = `Combined receipt for Live Shows ${payable.map(({ show }) => show.show_number).join(', ')}${combinedVatExempt ? ' (VAT Exempt)' : ''}`;
      const invoice = await supabaseHelpers.createDocument({
        document_type: 'invoice',
        document_number: docNumber,
        client_id: client?.id || selectedClientId,
        client_name: client?.name || '',
        client_email: client?.email || '',
        client_phone: client?.phone || '',
        client_address: client?.address || '',
        client_trn: client?.trn || '',
        client_emirate: client?.emirate || '',
        issue_date: combinedIssueDate || new Date().toISOString().split('T')[0],
        subtotal: subtotal,
        tax_amount: taxAmount,
        discount_amount: 0,
        total: totalCombined,
        notes,
        terms: companySettings?.default_terms || '',
        status: 'paid',
        origin: 'dashboard',
        payment_method: combinedPaymentMethod,
        payment_card_amount: 0,
        payment_cash_amount: combinedPaymentMethod === 'cash' ? totalCombined : 0,
        delivery_fee: 0,
        delivery_provider_id: null,
      });

      for (const { show, totals } of payable) {
        await supabaseHelpers.createDocumentItem({
          document_id: invoice.id,
          description: `Live Show ${show.show_number}${show.item_name ? ` (${show.item_name})` : ''}`,
          quantity: 1,
          weight: 0,
          sell_by: 'unit',
          item_id: null,
          unit_price: totals.balance,
          amount: totals.balance,
        });
      }

      for (const { show, totals } of payable) {
        const qs = quotationsMap[show.id] || (await supabaseHelpers.getLiveShowQuotations(show.id));
        const q = qs.length > 0 ? qs[0] : null;
        const payment = await supabaseHelpers.recordLiveShowPayment(show.id, {
          type: 'full',
          amount: totals.balance,
          method: combinedPaymentMethod,
          quotation_id: q?.id || null,
        });
        const iso = `${combinedIssueDate || new Date().toISOString().split('T')[0]}T12:00:00Z`;
        try { await supabaseHelpers.updateLiveShowPaymentDate(payment.id, iso); } catch {}
      }

      setShowCombinedModal(false);
      setSelectedLiveShowIds([]);
      await loadLiveShowsPage();
      if (onOrderSaved) {
        onOrderSaved(invoice.id, { print: true });
      }
    } catch (e: any) {
      console.error('Failed to create combined receipt', e);
      setError(e?.message || 'Failed to create combined receipt.');
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
    const mult = mode === 'delivery' && selectedProvider?.priceMultiplier && selectedProvider.priceMultiplier > 0
      ? Number(selectedProvider.priceMultiplier)
      : 0;
    const adjustedPrice = mult > 0 ? Number((price * mult).toFixed(2)) : price;
    setCart((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name,
        unitPrice: adjustedPrice,
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

  function handleOverrideChange(itemId: string, value: string) {
    setPricingDirty(true);
    setPricingForm((prev) => ({ ...prev, [itemId]: value }));
  }

  async function saveProviderPricing() {
    const provider = selectedProvider as any;
    if (!provider) return;
    const providerKey = provider.id;
    let providerId = providerKey;
    const overridesArr = Object.entries(pricingForm)
      .map(([itemId, val]) => {
        const parsed = parseFloat(val);
        if (!Number.isFinite(parsed)) return null;
        const prod = products.find((p) => p.id === itemId);
        return {
          itemId,
          sku: prod?.sku,
          price: Number(parsed.toFixed(2)),
        };
      })
      .filter(Boolean) as any[];
    const multParsed = parseFloat(multiplierInput);
    const payload = {
      priceMultiplier: Number.isFinite(multParsed) ? Number(multParsed) : undefined,
      overrides: overridesArr,
    };
    try {
      // Ensure provider exists in DB and get its ID
      const ensured = await supabaseHelpers.findOrCreateDeliveryProvider({
        name: provider.name,
        phone: provider.phone,
        method: (provider as any).method,
        managed: provider.managed,
      });
      providerId = ensured.id;
      // Persist multiplier
      if (typeof payload.priceMultiplier !== 'undefined') {
        await supabaseHelpers.updateDeliveryProvider(providerId, { price_multiplier: payload.priceMultiplier });
      }
      // Persist overrides server-side: upsert new ones and delete removed
      await supabaseHelpers.upsertDeliveryProviderOverrides(
        providerId,
        payload.overrides.map((o) => ({ item_id: o.itemId, sku: o.sku, price: o.price }))
      );
      const keepIds = payload.overrides.map((o) => o.itemId);
      await supabaseHelpers.deleteDeliveryProviderOverridesExcept(providerId, keepIds);
      setProviders((prev) =>
        prev.map((p: any) =>
          p.id === providerKey || p.id === providerId
            ? { ...p, id: providerId, priceMultiplier: payload.priceMultiplier, priceOverrides: payload.overrides }
            : p
        )
      );
      setSelectedProviderId((prev) => (prev === providerKey ? providerId : prev));
      setPricingDirty(false);
      setShowPricingModal(false);
    } catch (e) {
      console.warn('Failed to persist provider pricing to server', e);
      const msg = (e && (e as any).message) ? String((e as any).message) : String(e);
      setError(`Failed to save provider pricing: ${msg}`);
    }
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
    if (savingRef.current || saving) return; // guard against double clicks
    setError('');
    savingRef.current = true;
    setSaving(true);
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
        // Reset LS-specific fields but keep customer so multiple shows can be added for the same client
        setLsItemName('');
        setLsKg(0);
        setLsPeopleCount(0);
        setLsDate('');
        setLsTime('');
        setLsLocation('');
        setLsNotes('');
        setEstimatedTotal(0);
        await loadLiveShowsPage();
        return;
      }

      const posMode = mode === 'in_store' ? 'in-store' : 'delivery';
      const items = cart.map((i) => {
        const basis = i.sell_by === 'weight'
          ? Math.max(1, i.quantity) * (i.weight ?? 0)
          : i.quantity;
        // Apply percentage discount per item in saved document items so receipt shows per-item deductions
        const pct = discountType === 'percentage'
          ? Math.max(0, Math.min(Number(discountInput || 0), 100))
          : 0;
        const unitPriceEffective = pct > 0
          ? Number((i.unitPrice * (1 - pct / 100)).toFixed(2))
          : i.unitPrice;
        return {
          description: i.name,
          quantity: i.quantity,
          weight: i.weight ?? 0,
          unit_price: unitPriceEffective,
          amount: unitPriceEffective * basis,
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

      // Ensure we only pass supported payment methods to save helper
      // Map UI 'provider' to 'transfer' for persistence and type compatibility
      const paymentMethodForSave: 'card' | 'cash' | 'both' | 'cod' | 'transfer' =
        paymentMethod === 'provider' ? 'transfer' : paymentMethod;

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
          paymentMethod: paymentMethodForSave,
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
          issueDate: orderDate,
          vatExempt,
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
      setDiscountInput(0);
      setDiscountType('amount');
      setPaymentMethod(mode === 'in_store' ? 'cash' : 'cod');
      if (onOrderSaved) {
        onOrderSaved(doc.id, { print: true });
      } else {
        onBack();
      }
    } catch (e: any) {
      console.error('Failed to save POS order', e);
      setError(e?.message || 'Failed to save order. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function openCustomerModal() {
    setShowCustomerModal(true);
    if (existingClients.length === 0) {
      setClientsLoading(true);
      try {
        const clients = await supabaseHelpers.getClientsCached();
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
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <h3 className="text-sm font-semibold text-slate-700">Existing Live Shows</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={openCombinedReceiptModal}
                        className="text-xs px-3 py-1 bg-slate-800 text-white rounded hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={selectedLiveShows.length < 2 || hasMixedClients || combinedBalance <= 0}
                        title="Generate one receipt for selected live shows (same customer)"
                      >
                        Combined Receipt
                      </button>
                      <button
                        onClick={async () => {
                          // Manual refresh
                          await loadLiveShowsPage();
                        }}
                        className="text-xs px-2 py-1 border border-slate-200 rounded hover:bg-slate-50"
                      >
                        Refresh
                      </button>
                    </div>
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
                            <th className="text-left px-3 py-2 border-b w-10">
                              <input
                                type="checkbox"
                                className="rounded border-slate-300"
                                checked={liveShows.length > 0 && liveShows.every((s) => selectedLiveShowIds.includes(s.id))}
                                onChange={() => toggleSelectAllLiveShows(true)}
                              />
                            </th>
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
                                <td className="px-3 py-2 text-center">
                                  <input
                                    type="checkbox"
                                    className="rounded border-slate-300"
                                    checked={selectedLiveShowIds.includes(s.id)}
                                    onChange={() => toggleLiveShowSelection(s.id)}
                                  />
                                </td>
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
                                    <button
                                      onClick={() => handleDeleteLiveShow(s.id)}
                                      className="text-xs px-2 py-1 border border-red-200 text-red-700 rounded hover:bg-red-50 inline-flex items-center gap-1"
                                      title="Delete Live Show"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {(() => {
                        const totalPages = Math.max(1, Math.ceil(lsTotal / LS_PAGE_SIZE));
                        return (
                          <div className="flex items-center justify-between px-2 py-2 border border-t-0 border-slate-200 rounded-b-lg bg-slate-50">
                            <div className="text-xs text-slate-600">Page {lsPage} of {totalPages} — {lsTotal} total</div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setLsPage((p) => Math.max(1, p - 1))}
                                disabled={lsPage <= 1}
                                className={`text-xs px-2 py-1 rounded border ${lsPage <= 1 ? 'border-slate-200 text-slate-300 cursor-not-allowed' : 'border-slate-200 text-slate-700 hover:bg-white'}`}
                              >
                                Prev
                              </button>
                              <button
                                onClick={() => setLsPage((p) => Math.min(totalPages, p + 1))}
                                disabled={lsPage >= totalPages}
                                className={`text-xs px-2 py-1 rounded border ${lsPage >= totalPages ? 'border-slate-200 text-slate-300 cursor-not-allowed' : 'border-slate-200 text-slate-700 hover:bg-white'}`}
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        );
                      })()}
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
                <p>
                  Discount{discountType === 'percentage' ? ` (${Math.max(0, Math.min(Number(discountInput || 0), 100))}% )` : ''}
                </p>
                <p>-{discountAmount.toFixed(2)}</p>
              </div>
            )}
            {effectiveTaxRate > 0 && (
              <div className="flex items-center justify-between text-slate-600 mt-2">
                <p>Tax ({effectiveTaxRate}% {vatExempt ? ' - VAT Exempt' : ''})</p>
                <p>{taxAmount.toFixed(2)}</p>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="rounded border-slate-300"
                  checked={vatExempt}
                  onChange={(e) => setVatExempt(e.target.checked)}
                />
                VAT Exempt this receipt
              </label>
              {vatExempt && <span className="text-xs text-amber-600">Tax removed</span>}
            </div>
            <div className="flex items-center justify-between text-slate-800 font-semibold mt-2">
              <p>Total</p>
              <p>{total.toFixed(2)}</p>
            </div>
            {mode !== 'live_show' && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="text-sm text-slate-600">Discount Type</label>
                  <div className="mt-1 inline-flex rounded-lg border border-slate-200 overflow-hidden">
                    <button
                      type="button"
                      className={`px-3 py-1.5 text-sm ${discountType === 'amount' ? 'bg-slate-100 text-slate-800' : 'bg-white text-slate-700'} border-r border-slate-200`}
                      onClick={() => setDiscountType('amount')}
                    >
                      Amount
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1.5 text-sm ${discountType === 'percentage' ? 'bg-slate-100 text-slate-800' : 'bg-white text-slate-700'}`}
                      onClick={() => setDiscountType('percentage')}
                    >
                      Percentage
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-600">{discountType === 'percentage' ? 'Percentage' : 'Amount'}</label>
                  <input
                    type="number"
                    min={0}
                    max={discountType === 'percentage' ? 100 : undefined}
                    step={discountType === 'percentage' ? '0.01' : '0.01'}
                    value={Number.isFinite(discountInput) ? discountInput : 0}
                    onChange={(e) => setDiscountInput(parseFloat(e.target.value) || 0)}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg"
                    placeholder={discountType === 'percentage' ? 'e.g. 10 for 10%' : 'e.g. 5.00'}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="mt-6 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
                    onClick={() => { setDiscountInput(0); setDiscountType('amount'); }}
                  >
                    Clear
                  </button>
                </div>
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
                        <div className="mt-3 flex items-center justify-between">
                          <div className="text-xs text-slate-600">
                            Provider Pricing: Multiplier {typeof (selectedProvider as any).priceMultiplier !== 'undefined' && (selectedProvider as any).priceMultiplier !== null ? String(Number((selectedProvider as any).priceMultiplier)) : '-'}, Overrides {Array.isArray((selectedProvider as any).priceOverrides) ? (selectedProvider as any).priceOverrides.length : 0}
                          </div>
                          <button
                            onClick={() => setShowPricingModal(true)}
                            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white hover:bg-slate-50"
                          >
                            Edit Item Pricing
                          </button>
                        </div>
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
                  {paymentMethod === 'provider' && (
                    <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
                      <p className="text-xs text-slate-500 mb-1">Provider Collect Amount</p>
                      <p className="text-sm font-semibold text-slate-800">{total.toFixed(2)}</p>
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

              {mode !== 'live_show' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Order Date</label>
                    <input
                      type="date"
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                    <p className="text-xs text-slate-500 mt-1">Defaults to today; used as issue date.</p>
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
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Package className="w-4 h-4" /> {saving ? 'Processing...' : (mode === 'live_show' ? 'Create Quotation' : 'Confirm Order')}
                </button>
              </div>

              {/* Saving Overlay */}
              {saving && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                  <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 w-[90vw] max-w-sm text-center">
                    <div className="animate-spin h-6 w-6 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto mb-3"></div>
                    <div className="text-slate-800 font-semibold mb-1">Saving order...</div>
                    <div className="text-slate-600 text-sm">Please wait, this may take a moment.</div>
                  </div>
                </div>
              )}
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
              {paymentSummary && (
                <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                    <div className="text-[11px] text-slate-500">Advance Paid</div>
                    <div className="font-semibold text-slate-800">{paymentSummary.advancePaid.toFixed(2)}</div>
                  </div>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                    <div className="text-[11px] text-slate-500">Full Paid</div>
                    <div className="font-semibold text-slate-800">{paymentSummary.fullPaid.toFixed(2)}</div>
                  </div>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                    <div className="text-[11px] text-slate-500">Estimated</div>
                    <div className="font-semibold text-slate-800">{paymentSummary.estimated.toFixed(2)}</div>
                  </div>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                    <div className="text-[11px] text-slate-500">Balance</div>
                    <div className="font-semibold text-slate-800">{paymentSummary.balance.toFixed(2)}</div>
                  </div>
                </div>
              )}
              {paymentType === 'advance' && paymentSummary && paymentSummary.balance > 0 && (
                <div className="mb-3 text-xs text-slate-600 flex items-center justify-between gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <span>Customer paying full now? Skip advance and record full payment.</span>
                  <button
                    onClick={() => {
                      setPaymentType('full');
                      setPaymentAmount(paymentSummary.balance);
                    }}
                    className="text-xs font-semibold text-amber-800 underline"
                  >
                    Switch to Full
                  </button>
                </div>
              )}
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

        {showCombinedModal && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white w-[95vw] max-w-2xl rounded-xl shadow-lg border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Combined Live Show Receipt</h3>
                <button onClick={() => setShowCombinedModal(false)} className="p-2 hover:bg-slate-50 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mb-3 text-sm text-slate-600">
                <p className="mb-1">Selected shows (same customer):</p>
                <div className="max-h-48 overflow-auto border border-slate-200 rounded-lg divide-y divide-slate-200">
                  {selectedLiveShows.map((s) => {
                    const totals = getLiveShowTotals(s.id);
                    return (
                      <div key={s.id} className="p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-800">{s.show_number}</p>
                          <p className="text-xs text-slate-500">{s.show_date || '—'} {s.show_time || ''} • {s.location || 'N/A'}</p>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-slate-500">Balance</div>
                          <div className="font-semibold text-slate-800">{totals.balance.toFixed(2)}</div>
                        </div>
                      </div>
                    );
                  })}
                  {selectedLiveShows.length === 0 && <div className="p-4 text-center text-slate-500">No live shows selected</div>}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Issue Date</label>
                  <input
                    type="date"
                    value={combinedIssueDate}
                    onChange={(e) => setCombinedIssueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
                  <select
                    value={combinedPaymentMethod}
                    onChange={(e) => setCombinedPaymentMethod(e.target.value as 'cash' | 'transfer')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  >
                    <option value="cash">Cash</option>
                    <option value="transfer">Bank Transfer</option>
                  </select>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={combinedVatExempt}
                    onChange={(e) => setCombinedVatExempt(e.target.checked)}
                  />
                  Remove VAT for this receipt
                </label>
              </div>
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
                <div>
                  <p className="text-xs text-slate-500">Subtotal</p>
                  <p className="text-base font-semibold text-slate-800">{combinedBalance.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Tax</p>
                  <p className="text-base font-semibold text-slate-800">
                    {(combinedBalance * (combinedVatExempt ? 0 : Number(companySettings?.tax_rate || 0)) / 100).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total</p>
                  <p className="text-base font-semibold text-slate-800">
                    {(combinedBalance + (combinedBalance * (combinedVatExempt ? 0 : Number(companySettings?.tax_rate || 0)) / 100)).toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setShowCombinedModal(false)} className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                <button
                  onClick={submitCombinedReceipt}
                  className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  disabled={selectedLiveShows.length === 0 || hasMixedClients || combinedBalance <= 0}
                >
                  Save & Print Receipt
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Provider Pricing Editor Modal */}
        {showPricingModal && selectedProvider && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white w-[95vw] max-w-3xl rounded-xl shadow-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Edit Provider Item Pricing</h3>
                <button onClick={() => setShowPricingModal(false)} className="p-2 hover:bg-slate-50 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Default Price Multiplier</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={multiplierInput}
                    onChange={(e) => {
                      setPricingDirty(true);
                      setMultiplierInput(e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Applied to items without explicit override. Leave blank or 0 to disable.</p>
                </div>
                <div className="max-h-[45vh] overflow-auto border border-slate-200 rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="text-left px-3 py-2">Item</th>
                        <th className="text-left px-3 py-2">SKU</th>
                        <th className="text-right px-3 py-2">Base Price</th>
                        <th className="text-right px-3 py-2">Override Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((prod) => (
                        <tr key={prod.id} className="border-t border-slate-200">
                          <td className="px-3 py-2 text-slate-800">{prod.name}</td>
                          <td className="px-3 py-2 text-slate-500">{prod.sku || '-'}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{Number(prod.price).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={pricingForm[prod.id] || ''}
                              onChange={(e) => handleOverrideChange(prod.id, e.target.value)}
                              className="w-32 px-2 py-1 border border-slate-200 rounded-lg"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowPricingModal(false)}
                    className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveProviderPricing}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Save Pricing
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
