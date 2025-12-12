import { useState, useEffect, useRef } from 'react';
import { Document, Client, CompanySettings } from '../lib/supabaseHelpers';
import { supabaseHelpers } from '../lib/supabaseHelpers';
import { ArrowLeft, Plus, Trash2, Save, Printer } from 'lucide-react';
import { generateDocumentNumber } from '../lib/documentHelpers';
import { DELIVERY_PROVIDERS, DeliveryProviderOption } from '../data/deliveryProviders';

type DocumentFormProps = {
  documentType: 'quotation' | 'invoice' | 'delivery_note';
  existingDocument: Document | null;
  duplicateFrom: Document | null;
  onBack: () => void;
  onSave: (documentId: string, options?: { print?: boolean }) => void;
};

type FormItem = {
  id: string;
  description: string;
  quantity: number;
  weight: number;
  sell_by: 'unit' | 'weight';
  unit_price: number;
  amount: number;
};

const allowedStatuses = ['draft', 'sent', 'paid', 'cancelled'] as const;
type Status = typeof allowedStatuses[number];
const emirateOptions = [
  'Abu Dhabi',
  'Dubai',
  'Sharjah',
  'Ajman',
  'Umm Al Quwain',
  'Ras Al Khaimah',
  'Fujairah',
] as const;
const originLabels = {
  dashboard: 'Dashboard',
  pos_in_store: 'POS In-Store',
  pos_delivery: 'POS Delivery',
} as const;

const invoicePaymentOptions = [
  { value: 'cash' as const, label: 'Cash' },
  { value: 'card' as const, label: 'Card' },
  { value: 'both' as const, label: 'Card + Cash' },
];

const deliveryPaymentOptions = [
  { value: 'cod' as const, label: 'Cash on Delivery (COD)' },
  { value: 'transfer' as const, label: 'Bank Transfer' },
];

function documentTypeLabel(type: 'quotation' | 'invoice' | 'delivery_note'): string {
  return type === 'invoice' ? 'tax receipt' : type.replace('_', ' ');
}

export default function DocumentForm({
  documentType,
  existingDocument,
  duplicateFrom,
  onBack,
  onSave,
}: DocumentFormProps) {
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [documentNumber, setDocumentNumber] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientTrn, setClientTrn] = useState('');
  const [clientEmirate, setClientEmirate] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<FormItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [status, setStatus] = useState<Status>('draft');
  const [submitAction, setSubmitAction] = useState<'save' | 'saveAndPrint'>('save');
  const [documentOrigin, setDocumentOrigin] = useState<'dashboard' | 'pos_in_store' | 'pos_delivery'>('dashboard');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'both' | 'cod' | 'transfer'>(
    documentType === 'delivery_note' ? 'cod' : 'cash'
  );
  const [paymentCardAmount, setPaymentCardAmount] = useState(0);
  const [paymentCashAmount, setPaymentCashAmount] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [deliveryProviderId, setDeliveryProviderId] = useState('');
  const [deliveryProviderName, setDeliveryProviderName] = useState('');
  const [deliveryProviderPhone, setDeliveryProviderPhone] = useState('');
  const [deliveryProviderManagerPhone, setDeliveryProviderManagerPhone] = useState('');
  const [deliveryProviderManaged, setDeliveryProviderManaged] = useState(false);
  // Live Show quotation: hide weight-related UI while keeping backend data intact
  const isLiveShowQuotation =
    documentType === 'quotation' &&
    ((existingDocument?.notes || duplicateFrom?.notes || '').toLowerCase().includes('live show quotation'));

  function applyDeliveryProvider(provider: DeliveryProviderOption | null) {
    if (provider) {
      setDeliveryProviderId(provider.id);
      setDeliveryProviderName(provider.name);
      setDeliveryProviderPhone(provider.phone);
      setDeliveryProviderManagerPhone(provider.managerPhone);
      setDeliveryProviderManaged(provider.managed);
    } else {
      setDeliveryProviderId('');
      setDeliveryProviderName('');
      setDeliveryProviderPhone('');
      setDeliveryProviderManagerPhone('');
      setDeliveryProviderManaged(false);
    }
  }

  function handleCardAmountChange(value: string) {
    const parsed = parseFloat(value);
    const numeric = Number.isFinite(parsed) ? parsed : 0;
    const clamped = Math.max(0, Math.min(numeric, total));
    setPaymentCardAmount(clamped);
  }

  function getPaymentMethodLabel(method: string): string {
    switch (method) {
      case 'cash':
        return 'Cash';
      case 'card':
        return 'Card';
      case 'both':
        return 'Card + Cash';
      case 'cod':
        return 'Cash on Delivery';
      case 'transfer':
        return 'Bank Transfer';
      default:
        return method;
    }
  }

  function handleDeliveryProviderChange(providerId: string) {
    const provider = DELIVERY_PROVIDERS.find((p) => p.id === providerId) || null;
    applyDeliveryProvider(provider);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (documentType === 'delivery_note') {
      if (paymentMethod !== 'cod' && paymentMethod !== 'transfer') {
        setPaymentMethod('cod');
      }
    } else if (documentType === 'invoice') {
      if (paymentMethod === 'cod' || paymentMethod === 'transfer') {
        setPaymentMethod('cash');
      }
    } else if (paymentMethod === 'cod' || paymentMethod === 'transfer') {
      setPaymentMethod('cash');
    }
  }, [documentType, paymentMethod]);

  async function loadData() {
    try {
      const [clientsData, settingsData, itemsData] = await Promise.all([
        supabaseHelpers.getClients(),
        supabaseHelpers.getCompanySettings(),
        existingDocument
          ? supabaseHelpers.getDocumentItems(existingDocument.id)
          : Promise.resolve([]),
      ]);

      setClients(clientsData);
      if (settingsData) {
        setCompanySettings(settingsData);
        setTerms(settingsData.default_terms || '');
      }

      if (existingDocument) {
        setDocumentNumber(existingDocument.document_number);
        setClientId(existingDocument.client_id || '');
        setClientName(existingDocument.client_name || '');
        setClientEmail(existingDocument.client_email || '');
        setClientPhone(existingDocument.client_phone || '');
        setClientAddress(existingDocument.client_address || '');
        setClientTrn(existingDocument.client_trn || '');
        setClientEmirate(existingDocument.client_emirate || '');
        if (existingDocument.origin === 'pos_in_store' || existingDocument.origin === 'pos_delivery') {
          setDocumentOrigin(existingDocument.origin);
        } else {
          setDocumentOrigin('dashboard');
        }
        setIssueDate(existingDocument.issue_date?.toString().split('T')[0] || new Date().toISOString().split('T')[0]);
        setDueDate(existingDocument.due_date ? new Date(existingDocument.due_date).toISOString().split('T')[0] : '');
        setDiscount(Number(existingDocument.discount_amount) || 0);
        setNotes(existingDocument.notes || '');
        setTerms(existingDocument.terms || '');
        const statusValue = existingDocument.status && allowedStatuses.includes(existingDocument.status as any)
          ? (existingDocument.status as Status)
          : 'draft';
        setStatus(statusValue);
        const existingTotal = Number(existingDocument.total) || 0;
        const existingPaymentMethod =
          (existingDocument.payment_method as any) ||
          (existingDocument.document_type === 'delivery_note' ? 'cod' : 'cash');
        setPaymentMethod(existingPaymentMethod);
        let cardAmount = Number(existingDocument.payment_card_amount ?? 0);
        let cashAmount = Number(existingDocument.payment_cash_amount ?? 0);
        if (existingDocument.document_type === 'invoice') {
          if (existingPaymentMethod === 'card') {
            cardAmount = existingTotal || cardAmount;
            cashAmount = 0;
          } else if (existingPaymentMethod === 'cash') {
            cardAmount = 0;
            cashAmount = existingTotal || cashAmount;
          } else if (existingPaymentMethod === 'both') {
            if (cardAmount <= 0 || cardAmount >= existingTotal) {
              cardAmount = existingTotal > 0 ? existingTotal / 2 : 0;
            }
            cashAmount = Math.max(existingTotal - cardAmount, 0);
          }
        } else if (existingDocument.document_type === 'delivery_note') {
          cardAmount = 0;
          cashAmount = existingPaymentMethod === 'cod' ? existingTotal || cashAmount : 0;
        }
        setPaymentCardAmount(cardAmount || 0);
        setPaymentCashAmount(cashAmount || 0);
        setDeliveryFee(Number(existingDocument.delivery_fee) || 0);
        if (existingDocument.delivery_provider_id) {
          try {
            const prov = await supabaseHelpers.getDeliveryProviderById(existingDocument.delivery_provider_id);
            setDeliveryProviderName(prov?.name || '');
            setDeliveryProviderPhone(prov?.phone || '');
            setDeliveryProviderManagerPhone('');
            setDeliveryProviderManaged(Boolean(prov?.managed));
            const matchedProvider = DELIVERY_PROVIDERS.find(
              (provider) => provider.name.toLowerCase() === (prov?.name || '').toLowerCase()
            );
            setDeliveryProviderId(matchedProvider ? matchedProvider.id : '');
          } catch (e) {
            console.warn('Failed to load delivery provider info', e);
            setDeliveryProviderName('');
            setDeliveryProviderPhone('');
            setDeliveryProviderManagerPhone('');
            setDeliveryProviderManaged(false);
            setDeliveryProviderId('');
          }
        } else {
          setDeliveryProviderName('');
          setDeliveryProviderPhone('');
          setDeliveryProviderManagerPhone('');
          setDeliveryProviderManaged(false);
          setDeliveryProviderId('');
        }

        if (itemsData) {
          setItems(
            itemsData.map((item) => ({
              id: item.id,
              description: item.description,
              quantity: Number(item.quantity),
              weight: isLiveShowQuotation ? 0 : Number((item as any).weight ?? 0),
              sell_by: isLiveShowQuotation ? 'unit' : ((item as any).sell_by === 'weight' ? 'weight' : 'unit'),
              unit_price: Number(item.unit_price),
              amount: Number(item.amount),
            }))
          );
        }
      } else if (duplicateFrom) {
        const newNumber = await generateDocumentNumber(documentType);
        setDocumentNumber(newNumber);
        setClientId(duplicateFrom.client_id || '');
        setClientName(duplicateFrom.client_name || '');
        setClientEmail(duplicateFrom.client_email || '');
        setClientPhone(duplicateFrom.client_phone || '');
        setClientAddress(duplicateFrom.client_address || '');
        setClientTrn(duplicateFrom.client_trn || '');
        setClientEmirate(duplicateFrom.client_emirate || '');
        if (duplicateFrom.origin === 'pos_in_store' || duplicateFrom.origin === 'pos_delivery') {
          setDocumentOrigin(duplicateFrom.origin);
        } else {
          setDocumentOrigin('dashboard');
        }
        setDiscount(Number(duplicateFrom.discount_amount) || 0);
        setNotes(duplicateFrom.notes || '');
        setTerms(duplicateFrom.terms || '');
        const duplicateTotal = Number(duplicateFrom.total) || 0;
        const duplicatePaymentMethod =
          (duplicateFrom.payment_method as any) ||
          (duplicateFrom.document_type === 'delivery_note' ? 'cod' : 'cash');
        setPaymentMethod(duplicatePaymentMethod);
        let dupCardAmount = Number(duplicateFrom.payment_card_amount ?? 0);
        let dupCashAmount = Number(duplicateFrom.payment_cash_amount ?? 0);
        if (duplicateFrom.document_type === 'invoice') {
          if (duplicatePaymentMethod === 'card') {
            dupCardAmount = duplicateTotal || dupCardAmount;
            dupCashAmount = 0;
          } else if (duplicatePaymentMethod === 'cash') {
            dupCardAmount = 0;
            dupCashAmount = duplicateTotal || dupCashAmount;
          } else if (duplicatePaymentMethod === 'both') {
            if (dupCardAmount <= 0 || dupCardAmount >= duplicateTotal) {
              dupCardAmount = duplicateTotal > 0 ? duplicateTotal / 2 : 0;
            }
            dupCashAmount = Math.max(duplicateTotal - dupCardAmount, 0);
          }
        } else if (duplicateFrom.document_type === 'delivery_note') {
          dupCardAmount = 0;
          dupCashAmount = duplicatePaymentMethod === 'cod' ? duplicateTotal || dupCashAmount : 0;
        }
        setPaymentCardAmount(dupCardAmount || 0);
        setPaymentCashAmount(dupCashAmount || 0);
        setDeliveryFee(Number(duplicateFrom.delivery_fee) || 0);
        if (duplicateFrom.delivery_provider_id) {
          try {
            const prov = await supabaseHelpers.getDeliveryProviderById(duplicateFrom.delivery_provider_id);
            setDeliveryProviderName(prov?.name || '');
            setDeliveryProviderPhone(prov?.phone || '');
            setDeliveryProviderManagerPhone('');
            setDeliveryProviderManaged(Boolean(prov?.managed));
            const duplicateMatchedProvider = DELIVERY_PROVIDERS.find(
              (provider) => provider.name.toLowerCase() === (prov?.name || '').toLowerCase()
            );
            setDeliveryProviderId(duplicateMatchedProvider ? duplicateMatchedProvider.id : '');
          } catch (e) {
            console.warn('Failed to load delivery provider for duplicate', e);
            setDeliveryProviderName('');
            setDeliveryProviderPhone('');
            setDeliveryProviderManagerPhone('');
            setDeliveryProviderManaged(false);
            setDeliveryProviderId('');
          }
        } else {
          setDeliveryProviderName('');
          setDeliveryProviderPhone('');
          setDeliveryProviderManagerPhone('');
          setDeliveryProviderManaged(false);
          setDeliveryProviderId('');
        }

        const dupItems = await supabaseHelpers.getDocumentItems(duplicateFrom.id);
        if (dupItems) {
          setItems(
            dupItems.map((item) => ({
              id: crypto.randomUUID(),
              description: item.description,
              quantity: Number(item.quantity),
              weight: isLiveShowQuotation ? 0 : Number((item as any).weight ?? 0),
              sell_by: isLiveShowQuotation ? 'unit' : ((item as any).sell_by === 'weight' ? 'weight' : 'unit'),
              unit_price: Number(item.unit_price),
              amount: Number(item.amount),
            }))
          );
        }
      } else {
        const newNumber = await generateDocumentNumber(documentType);
        setDocumentNumber(newNumber);
        setClientId('');
        setClientName('');
        setClientEmail('');
        setClientPhone('');
        setClientAddress('');
        setClientTrn('');
        setClientEmirate('');
        setDocumentOrigin('dashboard');
        setPaymentMethod(documentType === 'delivery_note' ? 'cod' : 'cash');
        setPaymentCardAmount(0);
        setPaymentCashAmount(0);
        setDeliveryFee(0);
        applyDeliveryProvider(null);
        addItem();
      }
    } catch (error) {
      console.error('Error loading form data:', error);
    }
  }

  function handleClientSelect(selectedClientId: string) {
    setClientId(selectedClientId);
    const client = clients.find((c) => c.id === selectedClientId);
    if (client) {
      setClientName(client.name || '');
      setClientEmail(client.email || '');
      setClientPhone(client.phone || '');
      setClientAddress(client.address || '');
      setClientTrn(client.trn || '');
      setClientEmirate(client.emirate || '');
    }
  }

  function addItem() {
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        description: '',
        quantity: 1,
        weight: 0,
        sell_by: 'unit',
        unit_price: 0,
        amount: 0,
      },
    ]);
  }

  function removeItem(id: string) {
    setItems(items.filter((item) => item.id !== id));
  }

  function updateItem(id: string, field: keyof FormItem, value: string | number) {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === 'quantity' || field === 'unit_price' || field === 'weight' || field === 'sell_by') {
            const basis = (updated as FormItem).sell_by === 'weight' ? Number((updated as FormItem).weight) : Number((updated as FormItem).quantity);
            (updated as FormItem).amount = basis * Number((updated as FormItem).unit_price);
          }
          return updated;
        }
        return item;
      })
    );
  }

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = companySettings ? (subtotal * Number(companySettings.tax_rate)) / 100 : 0;
  const total = subtotal + taxAmount - discount;

  useEffect(() => {
    if (documentType === 'invoice') {
      if (paymentMethod === 'cash') {
        if (paymentCardAmount !== 0) setPaymentCardAmount(0);
        if (paymentCashAmount !== total) setPaymentCashAmount(total);
      } else if (paymentMethod === 'card') {
        if (paymentCardAmount !== total) setPaymentCardAmount(total);
        if (paymentCashAmount !== 0) setPaymentCashAmount(0);
      } else if (paymentMethod === 'both') {
        const clampedCard = Math.max(0, Math.min(paymentCardAmount, total));
        if (clampedCard !== paymentCardAmount) {
          setPaymentCardAmount(clampedCard);
          setPaymentCashAmount(Math.max(total - clampedCard, 0));
        } else {
          const newCash = Math.max(total - clampedCard, 0);
          if (newCash !== paymentCashAmount) setPaymentCashAmount(newCash);
        }
      } else {
        if (paymentCardAmount !== 0) setPaymentCardAmount(0);
        if (paymentCashAmount !== 0) setPaymentCashAmount(0);
      }
    } else if (documentType === 'delivery_note') {
      if (paymentMethod === 'cod') {
        if (paymentCardAmount !== 0) setPaymentCardAmount(0);
        if (paymentCashAmount !== total) setPaymentCashAmount(total);
      } else {
        if (paymentCardAmount !== 0) setPaymentCardAmount(0);
        if (paymentCashAmount !== 0) setPaymentCashAmount(0);
      }
    } else {
      if (paymentCardAmount !== 0) setPaymentCardAmount(0);
      if (paymentCashAmount !== 0) setPaymentCashAmount(0);
    }
  }, [documentType, paymentMethod, total, paymentCardAmount, paymentCashAmount]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current || loading) {
      // Prevent double-submit while a save is in progress
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    console.log('Starting document save...');

    try {
      let savedClientId: string | null = clientId || null;

      if (!clientId && clientName) {
        const existingClient = await supabaseHelpers.getClientByName(clientName);

        if (existingClient) {
          savedClientId = existingClient.id;
        } else {
          const newClient = await supabaseHelpers.createClient({
            name: clientName,
            email: clientEmail || '',
            phone: clientPhone || '',
            address: clientAddress || '',
            trn: clientTrn || '',
            emirate: clientEmirate || '',
          });
          savedClientId = newClient.id;
        }
      }

      const normalizedPaymentMethod = (() => {
        if (documentType === 'delivery_note') {
          return paymentMethod === 'transfer' ? 'transfer' : 'cod';
        }
        if (documentType === 'invoice') {
          return paymentMethod === 'card' || paymentMethod === 'both' ? paymentMethod : 'cash';
        }
        return paymentMethod === 'card' || paymentMethod === 'both' ? paymentMethod : 'cash';
      })();

      if (documentType === 'invoice' && normalizedPaymentMethod === 'both' && total > 0) {
        if (paymentCardAmount <= 0 || paymentCardAmount >= total) {
          alert('For card + cash payments, enter a card amount greater than 0 and less than the total.');
          setLoading(false);
          return;
        }
      }

      if (documentType === 'delivery_note') {
        if (!deliveryProviderName) {
          alert('Please select a delivery provider.');
          setLoading(false);
          return;
        }
        if (!Number.isFinite(Number(deliveryFee)) || Number(deliveryFee) < 0) {
          alert('Enter a valid delivery fee (use 0 if not applicable).');
          setLoading(false);
          return;
        }
      }

      const roundedTotal = Number(total.toFixed(2));
      const clampedCardAmount = documentType === 'invoice'
        ? Math.max(0, Math.min(paymentMethod === 'card' ? roundedTotal : paymentCardAmount, roundedTotal))
        : 0;
      let cardAmountToSave = 0;
      let cashAmountToSave = 0;

      if (documentType === 'invoice') {
        if (normalizedPaymentMethod === 'card') {
          cardAmountToSave = roundedTotal;
          cashAmountToSave = 0;
        } else if (normalizedPaymentMethod === 'cash') {
          cardAmountToSave = 0;
          cashAmountToSave = roundedTotal;
        } else if (normalizedPaymentMethod === 'both') {
          cardAmountToSave = Number(clampedCardAmount.toFixed(2));
          cashAmountToSave = Number(Math.max(roundedTotal - cardAmountToSave, 0).toFixed(2));
        }
      } else if (documentType === 'delivery_note') {
        cardAmountToSave = 0;
        cashAmountToSave = normalizedPaymentMethod === 'cod' ? roundedTotal : 0;
      }

      const deliveryFeeValue = documentType === 'delivery_note' ? Number(deliveryFee) || 0 : 0;

      // Resolve delivery provider id for normalized schema when saving delivery notes
      let resolvedDeliveryProviderId: string | undefined = undefined;
      if (documentType === 'delivery_note' && (deliveryProviderName || deliveryProviderPhone)) {
        try {
          const prov = await supabaseHelpers.findOrCreateDeliveryProvider({
            name: deliveryProviderName || 'Delivery Provider',
            phone: deliveryProviderPhone || undefined,
            managed: Boolean(deliveryProviderManaged),
            method: 'external',
          });
          resolvedDeliveryProviderId = prov.id;
        } catch (e) {
          console.warn('Failed to resolve delivery provider, continuing without id', e);
        }
      }

      const documentData: Omit<Document, 'id' | 'created_at' | 'updated_at' | 'user_id'> = {
        document_type: documentType,
        document_number: documentNumber,
        client_id: savedClientId || null,
        client_name: clientName || '',
        client_email: clientEmail || '',
        client_phone: clientPhone || '',
        client_address: clientAddress || '',
        client_trn: clientTrn || '',
        client_emirate: clientEmirate || '',
        issue_date: issueDate,
        due_date: dueDate || undefined,
        subtotal,
        tax_amount: taxAmount,
        discount_amount: discount,
        total,
        notes: notes || '',
        terms: terms || '',
        status: status,
        origin: documentOrigin,
        payment_method: normalizedPaymentMethod,
        payment_card_amount: Number(cardAmountToSave.toFixed(2)),
        payment_cash_amount: Number(cashAmountToSave.toFixed(2)),
        delivery_fee: documentType === 'delivery_note' ? Number(deliveryFeeValue.toFixed(2)) : 0,
        delivery_provider_id: documentType === 'delivery_note' ? (resolvedDeliveryProviderId || null) : null,
      };

      console.log('Document data to save:', documentData);

      let documentId: string;

      if (existingDocument) {
        await supabaseHelpers.updateDocument(existingDocument.id, documentData);
        documentId = existingDocument.id;
        await supabaseHelpers.deleteDocumentItems(documentId);
      } else {
        const newDoc = await supabaseHelpers.createDocument(documentData);
        documentId = newDoc.id;
      }

      console.log('Document saved with ID:', documentId);

      for (const item of items) {
        const normalized = isLiveShowQuotation
          ? { ...item, weight: 0, sell_by: 'unit' as const }
          : item;
        await supabaseHelpers.createDocumentItem({
          document_id: documentId,
          description: normalized.description,
          quantity: normalized.quantity,
          weight: normalized.weight,
          sell_by: normalized.sell_by,
          unit_price: normalized.unit_price,
          amount: normalized.amount,
        });
      }

      console.log('Document and items saved successfully');
      onSave(documentId, { print: submitAction === 'saveAndPrint' });
    } catch (error) {
      console.error('Error saving document:', error);
      alert('Failed to save document. Please try again.');
    } finally {
      setLoading(false);
      submittingRef.current = false;
      setSubmitAction('save');
    }
  }

  const currentTypeLabel = documentTypeLabel(documentType);
  const title = existingDocument
    ? `Edit ${currentTypeLabel}`
    : duplicateFrom
    ? `Duplicate ${currentTypeLabel}`
    : `New ${currentTypeLabel}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8">
      <div className="max-w-5xl mx-auto px-6">
        <div className="mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-6 capitalize">{title}</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Document Number</label>
                <input
                  type="text"
                  value={documentNumber}
                  disabled
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Document Source</label>
                <div
                  className={`w-full px-4 py-2 rounded-lg border border-slate-200 ${
                    documentOrigin === 'dashboard'
                      ? 'bg-slate-50 text-slate-600'
                      : documentOrigin === 'pos_in_store'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-orange-50 text-orange-700'
                  }`}
                >
                  {originLabels[documentOrigin]}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Issue Date</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {documentType === 'invoice' && (
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {invoicePaymentOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(paymentMethod === 'card' || paymentMethod === 'both') && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Card Amount</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={(paymentMethod === 'card' ? total : paymentCardAmount).toFixed(2)}
                          onChange={(e) => handleCardAmountChange(e.target.value)}
                          disabled={paymentMethod === 'card'}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Cash Amount</label>
                      <input
                        type="number"
                        readOnly
                        value={paymentCashAmount.toFixed(2)}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
                      />
                    </div>
                  </div>
                </div>
              )}

              {documentType === 'delivery_note' && (
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {deliveryPaymentOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Delivery Fee (Reference)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={deliveryFee}
                      onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                      required
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Delivery Provider</label>
                    <select
                      value={deliveryProviderId}
                      onChange={(e) => handleDeliveryProviderChange(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select provider</option>
                      {DELIVERY_PROVIDERS.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                    {deliveryProviderName ? (
                      <>
                        <p className="text-sm font-semibold text-slate-800">{deliveryProviderName}</p>
                        {deliveryProviderPhone && (
                          <p className="text-xs text-slate-600">Phone: {deliveryProviderPhone}</p>
                        )}
                        {deliveryProviderManagerPhone && (
                          <p className="text-xs text-slate-600">Manager: {deliveryProviderManagerPhone}</p>
                        )}
                        <span
                          className={`mt-2 inline-flex px-2 py-1 rounded-full text-[11px] font-medium ${                            deliveryProviderManaged ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'                          }`}
                        >
                          {deliveryProviderManaged ? 'Managed Provider' : 'Unmanaged Provider'}
                        </span>
                      </>
                    ) : (
                      <p className="text-xs text-slate-500">Select a delivery provider to view details.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Client Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Select Existing Client</label>
                  <select
                    value={clientId}
                    onChange={(e) => handleClientSelect(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">-- New Client --</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Client Name *</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">TRN</label>
                  <input
                    type="text"
                    value={clientTrn}
                    onChange={(e) => setClientTrn(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Emirate</label>
                  <select
                    value={clientEmirate}
                    onChange={(e) => setClientEmirate(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="">Select Emirate</option>
                    {emirateOptions.map((emirate) => (
                      <option key={emirate} value={emirate}>
                        {emirate}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
                  <textarea
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-800">Items</h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-3 items-start bg-slate-50 p-4 rounded-lg">
                    <div className="flex-1">
                      {!isLiveShowQuotation && (
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs text-slate-600">Sell by:</span>
                          <div className="inline-flex rounded-md border border-slate-200 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => updateItem(item.id, 'sell_by', 'unit')}
                              className={`px-3 py-1 text-xs ${item.sell_by === 'unit' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}
                            >
                              Unit
                            </button>
                            <button
                              type="button"
                              onClick={() => updateItem(item.id, 'sell_by', 'weight')}
                              className={`px-3 py-1 text-xs ${item.sell_by === 'weight' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}
                            >
                              Weight
                            </button>
                          </div>
                          {item.sell_by === 'weight' && (
                            <div className="flex items-center gap-2 ml-2">
                              <button
                                type="button"
                                onClick={() => updateItem(item.id, 'weight', 0.5)}
                                className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded"
                              >
                                0.5 kg
                              </button>
                              <button
                                type="button"
                                onClick={() => updateItem(item.id, 'weight', 1)}
                                className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded"
                              >
                                1 kg
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-5">
                        <input
                          type="text"
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                          required
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          required={item.sell_by === 'unit'}
                          disabled={!isLiveShowQuotation && item.sell_by === 'weight'}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      {!isLiveShowQuotation && (
                        <div className="md:col-span-2">
                          <input
                            type="number"
                            placeholder="Weight"
                            value={item.weight}
                            onChange={(e) => updateItem(item.id, 'weight', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                            required={item.sell_by === 'weight'}
                            disabled={item.sell_by === 'unit'}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}
                      <div className="md:col-span-2">
                        <input
                          type="number"
                          placeholder={!isLiveShowQuotation && item.sell_by === 'weight' ? 'Price per kg' : 'Unit price'}
                          value={item.unit_price}
                          onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          required
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <input
                          type="text"
                          value={item.amount.toFixed(2)}
                          disabled
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-600"
                        />
                      </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Terms & Conditions</label>
                    <textarea
                      value={terms}
                      onChange={(e) => setTerms(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-6 h-fit">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-slate-700">
                      <span>Subtotal:</span>
                      <span className="font-medium">{subtotal.toFixed(2)}</span>
                    </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Tax ({companySettings?.tax_rate || 0}%):</span>
                    <span className="font-medium">{taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span>Discount:</span>
                    <input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                      className="w-24 px-3 py-1 border border-slate-200 rounded-lg text-right focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  {(documentType === 'invoice' || documentType === 'delivery_note') && (
                    <div className="flex justify-between text-slate-700">
                      <span>Payment Method:</span>
                      <span className="font-medium">{getPaymentMethodLabel(paymentMethod)}</span>
                    </div>
                  )}
                  {documentType === 'invoice' && (
                    <>
                      <div className="flex justify-between text-slate-700">
                        <span>Card Amount:</span>
                        <span className="font-medium">{paymentCardAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>Cash Amount:</span>
                        <span className="font-medium">{paymentCashAmount.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  {documentType === 'delivery_note' && (
                    <>
                      <div className="flex justify-between text-slate-700">
                        <span>COD Amount:</span>
                        <span className="font-medium">{paymentCashAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>Delivery Fee (ref):</span>
                        <span className="font-medium">{deliveryFee.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  <div className="border-t border-slate-300 pt-3 flex justify-between text-lg font-bold text-slate-800">
                    <span>Total:</span>
                    <span>{total.toFixed(2)}</span>
                  </div>
                </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6">
              <button
                type="button"
                onClick={onBack}
                className="px-6 py-3 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                onClick={() => setSubmitAction('saveAndPrint')}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer className="w-5 h-5" />
                {loading && submitAction === 'saveAndPrint' ? 'Saving...' : 'Save & Print'}
              </button>
              <button
                type="submit"
                disabled={loading}
                onClick={() => setSubmitAction('save')}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                {loading && submitAction === 'save' ? 'Saving...' : 'Save Document'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
