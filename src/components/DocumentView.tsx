import { useState, useEffect } from 'react';
import { Document, DocumentItem, CompanySettings } from '../lib/supabaseHelpers';
import { supabaseHelpers } from '../lib/supabaseHelpers';
import { ArrowLeft, CreditCard as Edit, Copy, Printer } from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/documentHelpers';

type DocumentViewProps = {
  document: Document;
  onBack: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  autoPrint?: boolean;
  onPrintComplete?: () => void;
};

export default function DocumentView({
  document,
  onBack,
  onEdit,
  onDuplicate,
  autoPrint = false,
  onPrintComplete,
}: DocumentViewProps) {
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [deliveryProvider, setDeliveryProvider] = useState<any | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [hasAutoPrinted, setHasAutoPrinted] = useState(false);

  useEffect(() => {
    setDataLoaded(false);
    setHasAutoPrinted(false);
    loadData();
  }, [document.id]);

  async function loadData() {
    try {
      const [itemsData, settingsData, providerData] = await Promise.all([
        supabaseHelpers.getDocumentItems(document.id),
        supabaseHelpers.getCompanySettings(),
        document.delivery_provider_id
          ? supabaseHelpers.getDeliveryProviderById(document.delivery_provider_id)
          : Promise.resolve(null),
      ]);

      setItems(itemsData);
      setCompanySettings(settingsData);
      setDeliveryProvider(providerData);
      setDataLoaded(true);
    } catch (error) {
      console.error('Error loading document data:', error);
    }
  }

  function handlePrint() {
    window.print();
  }

  useEffect(() => {
    if (autoPrint && dataLoaded && !hasAutoPrinted) {
      setHasAutoPrinted(true);
      setTimeout(() => {
        window.print();
        onPrintComplete?.();
      }, 200);
    }
  }, [autoPrint, dataLoaded, hasAutoPrinted, onPrintComplete]);

  const origin = document.origin;
  const isPOSInStore = origin === 'pos_in_store';
  const isPOSDelivery = origin === 'pos_delivery';
  const documentTitle = isPOSInStore
    ? 'POS IN-STORE RECEIPT'
    : isPOSDelivery
    ? 'DELIVERY RECEIPT'
    : document.document_type === 'quotation'
    ? 'QUOTATION'
    : document.document_type === 'invoice'
    ? 'RECEIPT'
    : 'DELIVERY NOTE';
  const originLabel = isPOSInStore ? 'POS In-Store Sale' : isPOSDelivery ? 'POS Delivery' : 'Dashboard';

  function getPaymentMethodLabel(method?: string | null): string {
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
        return method ? method.toUpperCase() : 'N/A';
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8">
      <div className="max-w-5xl mx-auto px-6">
        <div className="mb-6 flex justify-between items-center print:hidden">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>

          <div className="flex gap-3">
            <button
              onClick={onEdit}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={onDuplicate}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Duplicate
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print / PDF
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 print:shadow-none print:border-0">
          <div className="flex justify-between items-start mb-8">
            <div>
              {companySettings?.company_logo_url && (
                <img
                  src={companySettings.company_logo_url}
                  alt="Company Logo"
                  className="h-16 mb-4 object-contain"
                />
              )}
              <h2 className="text-xl font-bold text-slate-800">{companySettings?.company_name || 'Company Name'}</h2>
              <p className="text-slate-600 whitespace-pre-line">{companySettings?.company_address}</p>
              {companySettings?.company_trn && (
                <p className="text-slate-600">TRN: {companySettings.company_trn}</p>
              )}
            </div>

            <div className="text-right">
              <h1 className="text-3xl font-bold text-slate-800 mb-2">{documentTitle}</h1>
              <p className="text-slate-600 text-sm">
                <span className="font-semibold">Number:</span> {document.document_number}
              </p>
              <p className="text-slate-600 text-sm">
                <span className="font-semibold">Date:</span> {document.issue_date ? formatDate(document.issue_date) : '-'}
              </p>
              {document.due_date && (
                <p className="text-slate-600 text-sm">
                  <span className="font-semibold">Due:</span> {formatDate(document.due_date)}
                </p>
              )}
              <span
                className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${
                  document.status === 'paid'
                    ? 'bg-emerald-100 text-emerald-700'
                    : document.status === 'sent'
                    ? 'bg-blue-100 text-blue-700'
                    : document.status === 'cancelled'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {(document.status ?? 'draft').toUpperCase()}
              </span>
              <div
                className={`mt-2 inline-block px-3 py-1 rounded-full text-xs font-medium ${
                  isPOSInStore
                    ? 'bg-emerald-100 text-emerald-700'
                    : isPOSDelivery
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {originLabel}
              </div>
            </div>
          </div>

          <div className="mb-8 p-6 bg-slate-50 rounded-lg">
            <h3 className="text-sm font-semibold text-slate-700 mb-2 uppercase">Bill To:</h3>
            <p className="font-semibold text-slate-800">{document.client_name}</p>
            {document.client_email && <p className="text-slate-600">{document.client_email}</p>}
            {document.client_phone && <p className="text-slate-600">{document.client_phone}</p>}
            {document.client_address && <p className="text-slate-600 whitespace-pre-line">{document.client_address}</p>}
            {document.client_trn && <p className="text-slate-600">TRN: {document.client_trn}</p>}
            {document.client_emirate && <p className="text-slate-600">Emirate: {document.client_emirate}</p>}
          </div>

          <div className="mb-8">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-slate-300">
                  <th className="text-left py-3 text-sm font-semibold text-slate-700 uppercase">Description</th>
                  <th className="text-right py-3 text-sm font-semibold text-slate-700 uppercase">Qty</th>
                  <th className="text-right py-3 text-sm font-semibold text-slate-700 uppercase">Unit Price</th>
                  <th className="text-right py-3 text-sm font-semibold text-slate-700 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-200">
                    <td className="py-3 text-slate-800">{item.description}</td>
                    <td className="text-right py-3 text-slate-700">{Number(item.quantity)}</td>
                    <td className="text-right py-3 text-slate-700">{formatCurrency(Number(item.unit_price))}</td>
                    <td className="text-right py-3 font-semibold text-slate-800">
                      {formatCurrency(Number(item.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end mb-8">
            <div className="w-80">
              <div className="flex justify-between py-2 text-slate-700">
                <span>Subtotal:</span>
                <span className="font-semibold">{formatCurrency(Number(document.subtotal))}</span>
              </div>
              <div className="flex justify-between py-2 text-slate-700">
                <span>Tax ({companySettings?.tax_rate || 0}%):</span>
                <span className="font-semibold">{formatCurrency(Number(document.tax_amount))}</span>
              </div>
              {Number(document.discount_amount) > 0 && (
                <div className="flex justify-between py-2 text-slate-700">
                  <span>Discount:</span>
                  <span className="font-semibold">-{formatCurrency(Number(document.discount_amount))}</span>
                </div>
              )}
              <div className="flex justify-between py-3 border-t-2 border-slate-300 text-lg font-bold text-slate-800">
                <span>Total:</span>
                <span>{formatCurrency(Number(document.total))}</span>
              </div>
          </div>
        </div>

        {(document.payment_method || Number(document.delivery_fee) > 0 || deliveryProvider) && (
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            {document.payment_method && (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase">Payment Details</h3>
                <div className="space-y-2 text-sm text-slate-700">
                  <div className="flex justify-between">
                    <span>Method</span>
                    <span className="font-medium">{getPaymentMethodLabel(document.payment_method)}</span>
                  </div>
                  {Number(document.payment_card_amount) > 0 && (
                    <div className="flex justify-between">
                      <span>Card</span>
                      <span className="font-medium">{formatCurrency(Number(document.payment_card_amount))}</span>
                    </div>
                  )}
                  {Number(document.payment_cash_amount) > 0 && (
                    <div className="flex justify-between">
                      <span>Cash</span>
                      <span className="font-medium">{formatCurrency(Number(document.payment_cash_amount))}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {(Number(document.delivery_fee) > 0 || deliveryProvider) && (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase">Delivery Details</h3>
                <div className="space-y-2 text-sm text-slate-700">
                  {deliveryProvider?.name && (
                    <div className="flex justify-between">
                      <span>Provider</span>
                      <span className="font-medium">{deliveryProvider.name}</span>
                    </div>
                  )}
                  {deliveryProvider?.phone && (
                    <div className="flex justify-between">
                      <span>Phone</span>
                      <span className="font-medium">{deliveryProvider.phone}</span>
                    </div>
                  )}
                  {typeof deliveryProvider?.managed === 'boolean' && (
                    <div className="flex justify-between">
                      <span>Status</span>
                      <span className="font-medium">
                        {deliveryProvider.managed ? 'Managed Provider' : 'Unmanaged Provider'}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Delivery Fee (ref)</span>
                    <span className="font-medium">{formatCurrency(Number(document.delivery_fee || 0))}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {document.notes && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-2 uppercase">Notes:</h3>
            <p className="text-slate-600 whitespace-pre-line">{document.notes}</p>
          </div>
          )}

          {document.terms && (
            <div className="pt-6 border-t border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700 mb-2 uppercase">Terms & Conditions:</h3>
              <p className="text-slate-600 text-sm whitespace-pre-line">{document.terms}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
