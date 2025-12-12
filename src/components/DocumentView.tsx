import { useState, useEffect, useRef } from 'react';
import { Document, DocumentItem, CompanySettings } from '../lib/supabaseHelpers';
import { supabaseHelpers } from '../lib/supabaseHelpers';
import { ArrowLeft, CreditCard as Edit, Copy, Printer } from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/documentHelpers';
import { generateReceipt } from '../utils/api';
import type { ReceiptPayload } from '../utils/api';
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
      companyTrn: companySettings?.company_trn || '',
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
    if (isPOS) {
      try {
        const payload: ReceiptPayload = { ...buildReceiptPayload(), mode: 'print' as const };
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
            const payload: ReceiptPayload = { ...buildReceiptPayload(), mode: 'print' as const };
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
    ? 'DELIVERY TAX RECEIPT'
    : document.document_type === 'quotation'
    ? 'QUOTATION'
    : document.document_type === 'invoice'
    ? 'TAX RECEIPT'
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

  const printAreaId = 'dashboard-print-area';

  return (
    <div className="min-h-screen py-8">
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

        {!isPOSInStore && (
          <style>
            {`
              @media print {
                body * { visibility: hidden; }
                #${printAreaId}, #${printAreaId} * { visibility: visible; }
                #${printAreaId} { position: absolute; left: 0; top: 0; width: 100%; }
              }
            `}
          </style>
        )}

        <div
          id={!isPOSInStore ? printAreaId : undefined}
          ref={printRef}
          className={`relative bg-white rounded-xl shadow-sm border border-slate-200 p-8 print:p-8 ${isPOSInStore ? 'print:hidden' : 'print:shadow-none print:border-0'}`}
        >
          <div className="space-y-6 text-sm text-slate-700">
            <div className="border border-slate-300 rounded-lg overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between p-4 border-b border-slate-300 gap-4">
                <div className="flex items-start gap-3">
                  {companySettings?.company_logo_url && (
                    <img
                      src={companySettings.company_logo_url}
                      alt="Company Logo"
                      className="h-20 w-auto object-contain"
                    />
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">{companySettings?.company_name || 'Company Name'}</h2>
                    {companySettings?.company_address && (
                      <p className="text-slate-600 whitespace-pre-line">{companySettings.company_address}</p>
                    )}
                    {companySettings?.company_trn && (
                      <p className="text-slate-700 font-semibold mt-1">VAT Reg No: {companySettings.company_trn}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{originLabel}</p>
                  <h1 className="text-2xl font-bold text-slate-800">{documentTitle}</h1>
                  <p className="text-slate-700"><span className="font-semibold">Receipt No:</span> {document.document_number}</p>
                  <p className="text-slate-700">
                    <span className="font-semibold">Issue Date:</span>{' '}
                    {document.issue_date ? formatDate(document.issue_date) : '-'}
                  </p>
                  {document.due_date && (
                    <p className="text-slate-700"><span className="font-semibold">Due Date:</span> {formatDate(document.due_date)}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 border-b border-slate-300">
                <div className="p-4 border-b md:border-b-0 md:border-r border-slate-300">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-2">Customer Details</h3>
                  <div className="space-y-1 text-slate-800">
                    <p className="font-semibold">{document.client_name || '-'}</p>
                    {document.client_phone && <p className="text-slate-700">Phone: {document.client_phone}</p>}
                    {document.client_email && <p className="text-slate-700">Email: {document.client_email}</p>}
                    {document.client_address && <p className="text-slate-700 whitespace-pre-line">Address: {document.client_address}</p>}
                    {document.client_emirate && <p className="text-slate-700">Emirate: {document.client_emirate}</p>}
                    {document.client_trn && <p className="text-slate-700 font-semibold">Customer TRN: {document.client_trn}</p>}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-2">Document Details</h3>
                  <div className="space-y-1 text-slate-800">
                    <p><span className="font-semibold">Receipt No:</span> {document.document_number}</p>
                    <p>
                      <span className="font-semibold">Issue Date:</span>{' '}
                      {document.issue_date ? formatDate(document.issue_date) : '-'}
                    </p>
                    {document.due_date && (
                      <p><span className="font-semibold">Due Date:</span> {formatDate(document.due_date)}</p>
                    )}
                    {document.payment_method && document.document_type !== 'quotation' && (
                      <p><span className="font-semibold">Payment:</span> {getPaymentMethodLabel(document.payment_method)}</p>
                    )}
                    {companySettings?.company_trn && (
                      <p className="font-semibold">VAT Reg No: {companySettings.company_trn}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4">
                <table className="w-full border border-slate-300 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border border-slate-300 px-2 py-2 text-center w-12">Sl</th>
                      <th className="border border-slate-300 px-2 py-2 text-left">Description</th>
                      {!isLiveShowQuotation && (
                        <th className="border border-slate-300 px-2 py-2 text-right">Weight</th>
                      )}
                      <th className="border border-slate-300 px-2 py-2 text-right">Qty</th>
                      <th className="border border-slate-300 px-2 py-2 text-right">Unit Price</th>
                      <th className="border border-slate-300 px-2 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const weight = Number((item as any).weight ?? 0);
                      return (
                        <tr key={item.id} className="odd:bg-white even:bg-slate-50">
                          <td className="border border-slate-300 px-2 py-2 text-center">{idx + 1}</td>
                          <td className="border border-slate-300 px-2 py-2 text-slate-800">{item.description}</td>
                          {!isLiveShowQuotation && (
                            <td className="border border-slate-300 px-2 py-2 text-right text-slate-700">{weight}</td>
                          )}
                          <td className="border border-slate-300 px-2 py-2 text-right text-slate-700">{Number(item.quantity)}</td>
                          <td className="border border-slate-300 px-2 py-2 text-right text-slate-700">{formatCurrency(Number(item.unit_price))}</td>
                          <td className="border border-slate-300 px-2 py-2 text-right font-semibold text-slate-800">{formatCurrency(Number(item.amount))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {(document.payment_method || Number(document.delivery_fee) > 0 || deliveryProvider) && (
                <div className="border border-slate-300 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-300 font-semibold text-slate-800 uppercase text-xs tracking-wide">Details</div>
                  <div className="p-4 space-y-2">
                    {document.payment_method && document.document_type !== 'quotation' && (
                      <p><span className="font-semibold">Payment:</span> {getPaymentMethodLabel(document.payment_method)}</p>
                    )}
                    {Number(document.payment_card_amount) > 0 && (
                      <p><span className="font-semibold">Card:</span> {formatCurrency(Number(document.payment_card_amount))}</p>
                    )}
                    {Number(document.payment_cash_amount) > 0 && (
                      <p><span className="font-semibold">Cash:</span> {formatCurrency(Number(document.payment_cash_amount))}</p>
                    )}
                    {(Number(document.delivery_fee) > 0 || deliveryProvider) && (
                      <>
                        {deliveryProvider?.name && <p><span className="font-semibold">Delivery:</span> {deliveryProvider.name}</p>}
                        {deliveryProvider?.phone && <p><span className="font-semibold">Phone:</span> {deliveryProvider.phone}</p>}
                        <p><span className="font-semibold">Delivery Fee (ref):</span> {formatCurrency(Number(document.delivery_fee || 0))}</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="md:ml-auto w-full md:w-80 border border-slate-300 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-300 font-semibold text-slate-800 uppercase text-xs tracking-wide">Summary</div>
                <div className="divide-y divide-slate-200">
                  <div className="flex justify-between px-4 py-2">
                    <span>Subtotal</span>
                    <span className="font-semibold">{formatCurrency(Number(document.subtotal))}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2">
                    <span>Tax ({companySettings?.tax_rate || 0}%)</span>
                    <span className="font-semibold">{formatCurrency(Number(document.tax_amount))}</span>
                  </div>
                  {Number(document.discount_amount) > 0 && (
                    <div className="flex justify-between px-4 py-2">
                      <span>Discount</span>
                      <span className="font-semibold">-{formatCurrency(Number(document.discount_amount))}</span>
                    </div>
                  )}
                  <div className="flex justify-between px-4 py-3 bg-slate-50 font-bold text-slate-900 text-base">
                    <span>Total</span>
                    <span>{formatCurrency(Number(document.total))}</span>
                  </div>
                </div>
              </div>
            </div>

            {document.notes && (
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-300 font-semibold text-slate-800 uppercase text-xs tracking-wide">Notes</div>
                <p className="p-4 text-slate-700 whitespace-pre-line">{document.notes}</p>
              </div>
            )}

            {document.terms && (
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-300 font-semibold text-slate-800 uppercase text-xs tracking-wide">Terms &amp; Conditions</div>
                <p className="p-4 text-slate-700 whitespace-pre-line">{document.terms}</p>
              </div>
            )}

            {companySettings?.company_stamp_url && originLabel === 'Dashboard' && (document.document_type === 'quotation' || document.document_type === 'invoice') && (
              <img
                src={companySettings.company_stamp_url}
                alt="Company Stamp"
                className="absolute right-6 bottom-6 h-60 opacity-80"
              />
            )}
          </div>
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
