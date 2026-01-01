type SummaryPanelProps = {
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  onDiscountChange: (value: number) => void;
  total: number;
  documentType: 'quotation' | 'invoice' | 'delivery_note';
  paymentMethodLabel: string;
  paymentCardAmount: number;
  paymentCashAmount: number;
  deliveryFee: number;
};

export function SummaryPanel({
  subtotal,
  taxRate,
  taxAmount,
  discount,
  onDiscountChange,
  total,
  documentType,
  paymentMethodLabel,
  paymentCardAmount,
  paymentCashAmount,
  deliveryFee,
}: SummaryPanelProps) {
  return (
    <div className="bg-slate-50 rounded-lg p-6 h-fit">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Summary</h3>
      <div className="space-y-3">
        <div className="flex justify-between text-slate-700">
          <span>Subtotal:</span>
          <span className="font-medium">{subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-slate-700">
          <span>Tax ({taxRate}%):</span>
          <span className="font-medium">{taxAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-slate-700">
          <span>Discount:</span>
          <input
            type="number"
            value={discount}
            onChange={(e) => onDiscountChange(parseFloat(e.target.value) || 0)}
            min="0"
            step="0.01"
            className="w-24 px-3 py-1 border border-slate-200 rounded-lg text-right focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {(documentType === 'invoice' || documentType === 'delivery_note') && (
          <div className="flex justify-between text-slate-700">
            <span>Payment Method:</span>
            <span className="font-medium">{paymentMethodLabel}</span>
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
  );
}
