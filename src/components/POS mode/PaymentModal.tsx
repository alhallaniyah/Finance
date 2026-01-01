import { X } from 'lucide-react';
import { LiveShow } from '../../lib/supabaseHelpers';

type PaymentSummary = {
  estimated: number;
  advancePaid: number;
  fullPaid: number;
  balance: number;
};

type PaymentModalProps = {
  show: boolean;
  onClose: () => void;
  showData: LiveShow | null;
  paymentType: 'advance' | 'full';
  onSwitchToFull: () => void;
  paymentSummary: PaymentSummary | null;
  paymentAmount: number;
  onPaymentAmountChange: (value: number) => void;
  paymentMethod: 'cash' | 'transfer';
  onPaymentMethodChange: (value: 'cash' | 'transfer') => void;
  onSubmit: () => void;
};

export function PaymentModal({
  show,
  onClose,
  showData,
  paymentType,
  onSwitchToFull,
  paymentSummary,
  paymentAmount,
  onPaymentAmountChange,
  paymentMethod,
  onPaymentMethodChange,
  onSubmit,
}: PaymentModalProps) {
  if (!show || !showData) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white w-[90vw] max-w-md rounded-xl shadow-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">
            {paymentType === 'advance' ? 'Record Advance Payment' : 'Record Full Payment'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="text-sm text-slate-600 mb-3">
          <p className="mb-1"><span className="font-semibold">Live Show:</span> {showData.show_number}</p>
          <p className="mb-1"><span className="font-semibold">Date:</span> {showData.show_date || 'N/A'} at {showData.show_time || 'N/A'}</p>
          <p><span className="font-semibold">Location:</span> {showData.location}</p>
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
              onClick={onSwitchToFull}
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
              onChange={(e) => onPaymentAmountChange(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => onPaymentMethodChange(e.target.value as 'cash' | 'transfer')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            >
              <option value="cash">Cash</option>
              <option value="transfer">Bank Transfer</option>
            </select>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Save & Print Receipt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
