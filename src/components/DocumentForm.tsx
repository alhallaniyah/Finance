import { useState, useEffect, useRef } from 'react';
import { Document, Client, CompanySettings } from '../lib/supabaseHelpers';
import { supabaseHelpers } from '../lib/supabaseHelpers';
import { generateDocumentNumber } from '../lib/documentHelpers';
import { DELIVERY_PROVIDERS, DeliveryProviderOption } from '../data/deliveryProviders';
import {
  FormItem,
  Status,
  allowedStatuses,
  documentTypeLabel,
} from './Document form/documentFormTypes';
import { DocumentHeader } from './Document form/DocumentHeader';
import { DocumentMetaSection } from './Document form/DocumentMetaSection';
import { InvoicePaymentSection } from './Document form/InvoicePaymentSection';
import { DeliveryPaymentSection } from './Document form/DeliveryPaymentSection';
import { ClientInfoSection } from './Document form/ClientInfoSection';
import { ItemsSection } from './Document form/ItemsSection';
import { NotesTermsSection } from './Document form/NotesTermsSection';
import { SummaryPanel } from './Document form/SummaryPanel';
import { FormActions } from './Document form/FormActions';

type DocumentFormProps = {
  documentType: 'quotation' | 'invoice' | 'delivery_note';
  existingDocument: Document | null;
  duplicateFrom: Document | null;
  onBack: () => void;
  onSave: (documentId: string, options?: { print?: boolean }) => void;
};

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
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <DocumentHeader title={title} onBack={onBack} />

          <form onSubmit={handleSubmit} className="space-y-6">
            <DocumentMetaSection
              documentNumber={documentNumber}
              documentOrigin={documentOrigin}
              status={status}
              issueDate={issueDate}
              dueDate={dueDate}
              onStatusChange={setStatus}
              onIssueDateChange={setIssueDate}
              onDueDateChange={setDueDate}
            />

            {documentType === 'invoice' && (
              <InvoicePaymentSection
                paymentMethod={paymentMethod as 'card' | 'cash' | 'both'}
                paymentCardAmount={paymentCardAmount}
                paymentCashAmount={paymentCashAmount}
                total={total}
                onPaymentMethodChange={(value) => setPaymentMethod(value)}
                onCardAmountChange={handleCardAmountChange}
              />
            )}

            {documentType === 'delivery_note' && (
              <DeliveryPaymentSection
                paymentMethod={paymentMethod as 'cod' | 'transfer'}
                onPaymentMethodChange={(value) => setPaymentMethod(value)}
                deliveryFee={deliveryFee}
                onDeliveryFeeChange={setDeliveryFee}
                deliveryProviderId={deliveryProviderId}
                onDeliveryProviderChange={handleDeliveryProviderChange}
                deliveryProviderName={deliveryProviderName}
                deliveryProviderPhone={deliveryProviderPhone}
                deliveryProviderManagerPhone={deliveryProviderManagerPhone}
                deliveryProviderManaged={deliveryProviderManaged}
                providers={DELIVERY_PROVIDERS}
              />
            )}

            <ClientInfoSection
              clients={clients}
              clientId={clientId}
              onClientSelect={handleClientSelect}
              clientName={clientName}
              onClientNameChange={setClientName}
              clientEmail={clientEmail}
              onClientEmailChange={setClientEmail}
              clientPhone={clientPhone}
              onClientPhoneChange={setClientPhone}
              clientTrn={clientTrn}
              onClientTrnChange={setClientTrn}
              clientEmirate={clientEmirate}
              onClientEmirateChange={setClientEmirate}
              clientAddress={clientAddress}
              onClientAddressChange={setClientAddress}
            />

            <ItemsSection
              items={items}
              isLiveShowQuotation={isLiveShowQuotation}
              onAddItem={addItem}
              onUpdateItem={updateItem}
              onRemoveItem={removeItem}
            />

            <div className="border-t border-slate-200 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <NotesTermsSection
                  notes={notes}
                  onNotesChange={setNotes}
                  terms={terms}
                  onTermsChange={setTerms}
                />
                <SummaryPanel
                  subtotal={subtotal}
                  taxRate={Number(companySettings?.tax_rate || 0)}
                  taxAmount={taxAmount}
                  discount={discount}
                  onDiscountChange={setDiscount}
                  total={total}
                  documentType={documentType}
                  paymentMethodLabel={getPaymentMethodLabel(paymentMethod)}
                  paymentCardAmount={paymentCardAmount}
                  paymentCashAmount={paymentCashAmount}
                  deliveryFee={deliveryFee}
                />
              </div>
            </div>

            <FormActions
              loading={loading}
              submitAction={submitAction}
              onCancel={onBack}
              onSaveAction={() => setSubmitAction('save')}
              onSaveAndPrintAction={() => setSubmitAction('saveAndPrint')}
            />
          </form>
        </div>
      </div>
    </div>
  );
}
