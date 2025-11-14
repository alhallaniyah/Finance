import { useState, useEffect, useRef } from 'react';
import { Document, DocumentItem, CompanySettings } from '../lib/supabaseHelpers';
import { supabaseHelpers } from '../lib/supabaseHelpers';
import { ArrowLeft, CreditCard as Edit, Copy, Printer } from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/documentHelpers';
import { generateReceipt } from '../utils/api';
import { printElementWithStyles } from '../lib/printHelpers';

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

  function buildReceiptPayload() {
    const itemsPayload = items.map((item) => {
      const qty = Number(item.quantity) || 0;
      const weight = Number((item as any).weight ?? 0) || 0;
      const sellBy = ((item as any).sell_by === 'weight' ? 'weight' : 'unit') as 'unit' | 'weight';
      const unitPrice = Number(item.unit_price) || 0;
      const amount = Number(item.amount) || 0;
      const name = `${item.description}${sellBy === 'weight' && weight > 0 ? ` (${weight} KG)` : ''}`;
      const quantity = sellBy === 'weight' && weight > 0 ? weight : qty;
      return {
        name,
        quantity,
        unitPrice,
        total: amount,
      };
    });

    const paidAmount = (Number(document.payment_card_amount) || 0) + (Number(document.payment_cash_amount) || 0) || (Number(document.total) || 0);

    const paymentLabel = getPaymentMethodLabel(document.payment_method);
    return {
      companyName: companySettings?.company_name || 'Company Name',
      companyAddress: companySettings?.company_address || '',
      companyPhone: '',
      receiptNo: document.document_number,
      date: document.issue_date ? formatDate(document.issue_date) : '-',
      ...(document.document_type !== 'quotation' ? { paymentMethod: paymentLabel } : {}),
      items: itemsPayload,
      subtotal: Number(document.subtotal) || 0,
      vat: Number(document.tax_amount) || 0,
      total: Number(document.total) || 0,
      paidAmount,
    };
  }

  const printRef = useRef<HTMLDivElement | null>(null);

  async function handlePrint() {
    const origin = document.origin;
    const isPOS = origin === 'pos_in_store';
    const isDashboard = !isPOS && origin !== 'pos_delivery';
    if (isPOS) {
      try {
        const payload = buildReceiptPayload();
        await generateReceipt(payload);
      } catch (e) {
        console.error('Failed to generate POS receipt PDF, falling back to browser print.', e);
        window.print();
      }
      return;
    }

    // Dashboard-origin: print the preview layout using TypeScript helper
    try {
      const target = printRef.current;
      if (target) {
        await printElementWithStyles(target, {
          title: `${document.document_type.toUpperCase()} ${document.document_number}`,
          keepScreenLayout: true,
        });
      } else {
        window.print();
      }
    } catch (e) {
      console.error('Dashboard print failed, falling back to browser print.', e);
      window.print();
    }
  }

  useEffect(() => {
    if (autoPrint && dataLoaded && !hasAutoPrinted) {
      setHasAutoPrinted(true);
      setTimeout(async () => {
        try {
          const origin = document.origin;
          const isPOS = origin === 'pos_in_store';
          const target = printRef.current;
          if (isPOS) {
            const payload = buildReceiptPayload();
            await generateReceipt(payload);
          } else if (target) {
            await printElementWithStyles(target, {
              title: `${document.document_type.toUpperCase()} ${document.document_number}`,
              keepScreenLayout: true,
            });
          } else {
            window.print();
          }
        } catch (e) {
          console.error('Auto print failed, falling back to browser print.', e);
          window.print();
        } finally {
          onPrintComplete?.();
        }
      }, 200);
    }
  }, [autoPrint, dataLoaded, hasAutoPrinted, onPrintComplete, document.origin]);

  const origin = document.origin;
  const isPOSInStore = origin === 'pos_in_store';
  const isPOSDelivery = origin === 'pos_delivery';
  const isLiveShowQuotation =
    document.document_type === 'quotation' &&
    typeof document.notes === 'string' &&
    document.notes.toLowerCase().includes('live show quotation');
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

        <div ref={printRef} className={`bg-white rounded-xl shadow-sm border border-slate-200 p-12 ${isPOSInStore ? 'print:hidden' : 'print:shadow-none print:border-0'}`}>
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
                  {!isLiveShowQuotation && (
                    <th className="text-right py-3 text-sm font-semibold text-slate-700 uppercase">Weight</th>
                  )}
                  <th className="text-right py-3 text-sm font-semibold text-slate-700 uppercase">Unit Price</th>
                  <th className="text-right py-3 text-sm font-semibold text-slate-700 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-200">
                    <td className="py-3 text-slate-800">{item.description}</td>
                    <td className="text-right py-3 text-slate-700">{Number(item.quantity)}</td>
                    {!isLiveShowQuotation && (
                      <td className="text-right py-3 text-slate-700">{Number((item as any).weight ?? 0)}</td>
                    )}
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
            {document.payment_method && document.document_type !== 'quotation' && (
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
      {isPOSInStore && (
        <>
          {/* Scoped thermal print styles for POS in-store receipts */}
          <style>
            {`
            @media print {
              @page { size: 80mm; margin: 0; }
              html, body { width: 80mm; margin: 0; padding: 0; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .thermal-pos { width: 80mm; padding: 2mm; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"; font-size: 11px; line-height: 1.25; }
              .thermal-pos * { break-inside: avoid; page-break-inside: avoid; }
              .thermal-line { border-top: 1px solid #000; margin: 1.5mm 0; }
              .thermal-header { text-align: center; }
              .thermal-header h2 { margin: 0; font-size: 12px; font-weight: 700; }
              .thermal-header p { margin: 0; font-size: 11px; }
              .thermal-grid-2 { display: grid; grid-template-columns: 1fr 1fr; column-gap: 2mm; }
              .thermal-kv { display: flex; justify-content: space-between; font-size: 11px; }
              .thermal-section-title { font-size: 11px; font-weight: 700; margin: 1mm 0; }
              .thermal-item-row { display: grid; grid-template-columns: 1fr auto 26mm; align-items: baseline; padding: 0.5mm 0; }
              .thermal-item-desc { margin-right: 2mm; }
              .thermal-item-meta { white-space: nowrap; margin-right: 2mm; }
              .thermal-amount { text-align: right; }
              .thermal-meta, .thermal-totals { margin-top: 1mm; }
              .thermal-footer { text-align: center; font-size: 11px; margin-top: 2mm; }
            }
          `}
          </style>

          {/* Print-only thermal layout */}
          <div className="thermal-pos hidden print:block mx-auto bg-white" style={{ width: '80mm' }}>
            <div className="thermal-header">
              <h2>{companySettings?.company_name || 'Company Name'}</h2>
              {companySettings?.company_address && (
                <p>{companySettings.company_address}</p>
              )}
              {companySettings?.company_trn && (<p>TRN: {companySettings.company_trn}</p>)}
            </div>

            <div className="thermal-line" />

            <div className="thermal-grid-2">
              <div>
                <div className="thermal-kv"><span>Receipt No:</span><span>{document.document_number}</span></div>
                <div className="thermal-kv"><span>Date:</span><span>{document.issue_date ? formatDate(document.issue_date) : '-'}</span></div>
              </div>
              <div>
                {document.payment_method && document.document_type !== 'quotation' && (
                  <div className="thermal-kv"><span>Payment:</span><span className="uppercase">{getPaymentMethodLabel(document.payment_method)}</span></div>
                )}
              </div>
            </div>

            <div className="thermal-section-title">ITEMS</div>

            <div>
              {items.map((item) => {
                const qty = Number(item.quantity) || 0;
                const weight = Number((item as any).weight ?? 0) || 0;
                const sellBy = ((item as any).sell_by === 'weight' ? 'weight' : 'unit') as 'unit' | 'weight';
                const unitPrice = Number(item.unit_price) || 0;
                const amount = Number(item.amount) || 0;
                const desc = `${item.description}${sellBy === 'weight' && weight > 0 ? ` (${weight} KG)` : ''}`;
                const qtyText = sellBy === 'weight' && weight > 0 ? `${weight} KG x ${formatCurrency(unitPrice)}` : `${qty} x ${formatCurrency(unitPrice)}`;
                return (
                  <div key={item.id} className="thermal-item-row">
                    <div className="thermal-item-desc">{desc}</div>
                    <div className="thermal-item-meta">{qtyText}</div>
                    <div className="thermal-amount">{formatCurrency(amount)}</div>
                  </div>
                );
              })}
            </div>

            <div className="thermal-meta">
              <div className="thermal-kv"><span>Items count:</span><span>{items.length}</span></div>
              {document.payment_method && document.document_type !== 'quotation' && (<div className="thermal-kv"><span>Payment:</span><span className="uppercase">{getPaymentMethodLabel(document.payment_method)}</span></div>)}
            </div>

            <div className="thermal-line" />

            <div className="thermal-totals">
              <div className="thermal-kv"><span>TOTAL:</span><span>{formatCurrency(Number(document.total) || 0)}</span></div>
              <div className="thermal-kv"><span>Paid amount:</span><span>{formatCurrency((Number(document.payment_card_amount) || 0) + (Number(document.payment_cash_amount) || 0) || (Number(document.total) || 0))}</span></div>
            </div>

            <div className="thermal-footer">Thank you for your purchase!</div>
          </div>
        </>
      )}
    </div>
  );
}
