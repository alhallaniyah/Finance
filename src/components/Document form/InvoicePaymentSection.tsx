import { invoicePaymentOptions } from './documentFormTypes';

type InvoicePaymentSectionProps = {
  paymentMethod: 'card' | 'cash' | 'both';
  paymentCardAmount: number;
  paymentCashAmount: number;
  total: number;
  onPaymentMethodChange: (value: 'card' | 'cash' | 'both') => void;
  onCardAmountChange: (value: string) => void;
};

export function InvoicePaymentSection({
  paymentMethod,
  paymentCardAmount,
  paymentCashAmount,
  total,
  onPaymentMethodChange,
  onCardAmountChange,
}: InvoicePaymentSectionProps) {
  return (
    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method</label>
        <select
          value={paymentMethod}
          onChange={(e) => onPaymentMethodChange(e.target.value as 'card' | 'cash' | 'both')}
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
              onChange={(e) => onCardAmountChange(e.target.value)}
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
  );
}
