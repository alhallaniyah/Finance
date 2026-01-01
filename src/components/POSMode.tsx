import { useEffect, useMemo, useRef, useState } from 'react';
import { supabaseHelpers, CompanySettings, Item, DeliveryProvider as DBDeliveryProvider, LiveShow, LiveShowPayment, LiveShowQuotation } from '../lib/supabaseHelpers';
import { generateDocumentNumber } from '../lib/documentHelpers';
import { DELIVERY_PROVIDERS } from '../data/deliveryProviders';
import { CartItem, Customer, Product } from './POS mode/posTypes';
import { POSModeHeader } from './POS mode/POSModeHeader';
import { ProductEntryPanel } from './POS mode/ProductEntryPanel';
import { LiveShowForm } from './POS mode/LiveShowForm';
import { LiveShowTable } from './POS mode/LiveShowTable';
import { CartItemsList } from './POS mode/CartItemsList';
import { TotalsSummary } from './POS mode/TotalsSummary';
import { PaymentDeliverySection } from './POS mode/PaymentDeliverySection';
import { CustomerDetailsSection } from './POS mode/CustomerDetailsSection';
import { SavingOverlay } from './POS mode/SavingOverlay';
import { CustomerModal } from './POS mode/CustomerModal';
import { PaymentModal } from './POS mode/PaymentModal';
import { CombinedReceiptModal } from './POS mode/CombinedReceiptModal';
import { ProviderPricingModal } from './POS mode/ProviderPricingModal';

type POSModeProps = {
  onBack: () => void;
  onOrderSaved?: (documentId: string, options?: { print?: boolean }) => void;
  onOpenKitchen?: () => void;
};

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

    const invalidWeightItem = cart.find(
      (i) => i.sell_by === 'weight' && (!Number.isFinite(i.weight) || i.weight! <= 0)
    );
    if (invalidWeightItem) {
      setError('Weight must be greater than 0 for items sold by weight.');
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
        <POSModeHeader
          mode={mode}
          onModeChange={setMode}
          onBack={onBack}
          onOpenKitchen={onOpenKitchen}
          userRole={userRole}
        />

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Product Entry or Live Show Details */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">{mode === 'live_show' ? 'Live Show Details' : 'Product Entry'}</h2>

            {mode === 'live_show' ? (
              <>
                <LiveShowForm
                  lsItemName={lsItemName}
                  onLsItemNameChange={setLsItemName}
                  lsKg={lsKg}
                  onLsKgChange={setLsKg}
                  lsPeopleCount={lsPeopleCount}
                  onLsPeopleCountChange={setLsPeopleCount}
                  lsDate={lsDate}
                  onLsDateChange={setLsDate}
                  lsTime={lsTime}
                  onLsTimeChange={setLsTime}
                  lsLocation={lsLocation}
                  onLsLocationChange={setLsLocation}
                  lsNotes={lsNotes}
                  onLsNotesChange={setLsNotes}
                  estimatedTotal={estimatedTotal}
                  onEstimatedTotalChange={setEstimatedTotal}
                />
                <LiveShowTable
                  liveShows={liveShows}
                  liveShowsLoading={liveShowsLoading}
                  paymentsMap={paymentsMap}
                  quotationsMap={quotationsMap}
                  selectedLiveShowIds={selectedLiveShowIds}
                  onToggleSelectAll={toggleSelectAllLiveShows}
                  onToggleSelection={toggleLiveShowSelection}
                  onOpenPaymentModal={openPaymentModal}
                  onDelete={handleDeleteLiveShow}
                  onRefresh={loadLiveShowsPage}
                  lsPage={lsPage}
                  lsTotal={lsTotal}
                  pageSize={LS_PAGE_SIZE}
                  onPageChange={setLsPage}
                  onOpenCombinedReceipt={openCombinedReceiptModal}
                  combinedBalance={combinedBalance}
                  hasMixedClients={hasMixedClients}
                  selectedCount={selectedLiveShows.length}
                />
              </>
            ) : (
              <ProductEntryPanel
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
                filteredProducts={filteredProducts}
                onAddToCart={addToCart}
                customSellBy={customSellBy}
                onCustomSellByChange={setCustomSellBy}
                onAddCustomItem={addCustomItem}
              />
            )}
          </div>

          {/* Right Panel - Order Cart */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Order Cart</h2>

            <CartItemsList
              cart={cart}
              onUpdateQuantity={updateQuantity}
              onUpdateWeight={updateWeight}
              onUpdateSellBy={updateSellBy}
              onRemoveItem={removeItem}
            />

            <TotalsSummary
              subtotal={subtotal}
              discountAmount={discountAmount}
              discountType={discountType}
              discountInput={discountInput}
              effectiveTaxRate={effectiveTaxRate}
              vatExempt={vatExempt}
              onVatExemptChange={setVatExempt}
              taxAmount={taxAmount}
              total={total}
              mode={mode}
              onDiscountTypeChange={setDiscountType}
              onDiscountInputChange={setDiscountInput}
              onClearDiscount={() => { setDiscountInput(0); setDiscountType('amount'); }}
            />

            <PaymentDeliverySection
              mode={mode}
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
              inStorePaymentOptions={inStorePaymentOptions}
              deliveryPaymentOptions={deliveryPaymentOptions}
              cardPaymentAmount={cardPaymentAmount}
              onCardPaymentAmountChange={handleCardPaymentAmountChange}
              cardAmount={cardAmount}
              cashAmount={cashAmount}
              deliveryFee={deliveryFee}
              onDeliveryFeeChange={setDeliveryFee}
              providerManaged={providerManaged}
              providers={providers}
              selectedProviderId={selectedProviderId}
              onProviderChange={setSelectedProviderId}
              selectedProvider={selectedProvider}
              onShowPricingModal={() => setShowPricingModal(true)}
              total={total}
            />

            <CustomerDetailsSection
              customer={customer}
              onCustomerChange={setCustomer}
              mode={mode}
              orderDate={orderDate}
              onOrderDateChange={setOrderDate}
              onOpenCustomerModal={openCustomerModal}
              onConfirmOrder={handleConfirmOrder}
              saving={saving}
            />

            <SavingOverlay saving={saving} />
          </div>
        </div>

        <CustomerModal
          show={showCustomerModal}
          onClose={() => setShowCustomerModal(false)}
          clientsLoading={clientsLoading}
          existingClients={existingClients}
          onSelectClient={selectExistingClient}
        />

        <PaymentModal
          show={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          showData={selectedShowForPayment}
          paymentType={paymentType}
          onSwitchToFull={() => {
            setPaymentType('full');
            if (paymentSummary) setPaymentAmount(paymentSummary.balance);
          }}
          paymentSummary={paymentSummary}
          paymentAmount={paymentAmount}
          onPaymentAmountChange={setPaymentAmount}
          paymentMethod={paymentMethodLS}
          onPaymentMethodChange={setPaymentMethodLS}
          onSubmit={submitLiveShowPayment}
        />

        <CombinedReceiptModal
          show={showCombinedModal}
          onClose={() => setShowCombinedModal(false)}
          selectedLiveShows={selectedLiveShows}
          getLiveShowTotals={getLiveShowTotals}
          combinedIssueDate={combinedIssueDate}
          onCombinedIssueDateChange={setCombinedIssueDate}
          combinedPaymentMethod={combinedPaymentMethod}
          onCombinedPaymentMethodChange={setCombinedPaymentMethod}
          combinedVatExempt={combinedVatExempt}
          onCombinedVatExemptChange={setCombinedVatExempt}
          combinedBalance={combinedBalance}
          taxRate={Number(companySettings?.tax_rate || 0)}
          onSubmit={submitCombinedReceipt}
          hasMixedClients={hasMixedClients}
        />

        <ProviderPricingModal
          show={showPricingModal}
          onClose={() => setShowPricingModal(false)}
          selectedProvider={selectedProvider}
          products={products}
          multiplierInput={multiplierInput}
          onMultiplierChange={(value) => {
            setPricingDirty(true);
            setMultiplierInput(value);
          }}
          pricingForm={pricingForm}
          onOverrideChange={handleOverrideChange}
          onSave={saveProviderPricing}
        />
      </div>
    </div>
  );
}
