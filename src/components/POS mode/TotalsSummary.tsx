type TotalsSummaryProps = {
  subtotal: number;
  discountAmount: number;
  discountType: 'amount' | 'percentage';
  discountInput: number;
  effectiveTaxRate: number;
  vatExempt: boolean;
  onVatExemptChange: (value: boolean) => void;
  taxAmount: number;
  total: number;
  mode: 'in_store' | 'delivery' | 'live_show';
  onDiscountTypeChange: (value: 'amount' | 'percentage') => void;
  onDiscountInputChange: (value: number) => void;
  onClearDiscount: () => void;
};

export function TotalsSummary({
  subtotal,
  discountAmount,
  discountType,
  discountInput,
  effectiveTaxRate,
  vatExempt,
  onVatExemptChange,
  taxAmount,
  total,
  mode,
  onDiscountTypeChange,
  onDiscountInputChange,
  onClearDiscount,
}: TotalsSummaryProps) {
  return (
    <>
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
            onChange={(e) => onVatExemptChange(e.target.checked)}
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
                onClick={() => onDiscountTypeChange('amount')}
              >
                Amount
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-sm ${discountType === 'percentage' ? 'bg-slate-100 text-slate-800' : 'bg-white text-slate-700'}`}
                onClick={() => onDiscountTypeChange('percentage')}
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
              onChange={(e) => onDiscountInputChange(parseFloat(e.target.value) || 0)}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg"
              placeholder={discountType === 'percentage' ? 'e.g. 10 for 10%' : 'e.g. 5.00'}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="mt-6 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              onClick={onClearDiscount}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </>
  );
}
