import { X } from 'lucide-react';
import { LiveShow } from '../../lib/supabaseHelpers';

type CombinedReceiptModalProps = {
  show: boolean;
  onClose: () => void;
  selectedLiveShows: LiveShow[];
  getLiveShowTotals: (id: string) => { balance: number };
  combinedIssueDate: string;
  onCombinedIssueDateChange: (value: string) => void;
  combinedPaymentMethod: 'cash' | 'transfer';
  onCombinedPaymentMethodChange: (value: 'cash' | 'transfer') => void;
  combinedVatExempt: boolean;
  onCombinedVatExemptChange: (value: boolean) => void;
  combinedBalance: number;
  taxRate: number;
  onSubmit: () => void;
  hasMixedClients: boolean;
};

export function CombinedReceiptModal({
  show,
  onClose,
  selectedLiveShows,
  getLiveShowTotals,
  combinedIssueDate,
  onCombinedIssueDateChange,
  combinedPaymentMethod,
  onCombinedPaymentMethodChange,
  combinedVatExempt,
  onCombinedVatExemptChange,
  combinedBalance,
  taxRate,
  onSubmit,
  hasMixedClients,
}: CombinedReceiptModalProps) {
  if (!show) return null;

  const taxAmount = (combinedBalance * (combinedVatExempt ? 0 : taxRate)) / 100;
  const total = combinedBalance + taxAmount;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white w-[95vw] max-w-2xl rounded-xl shadow-lg border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Combined Live Show Receipt</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mb-3 text-sm text-slate-600">
          <p className="mb-1">Selected shows (same customer):</p>
          <div className="max-h-48 overflow-auto border border-slate-200 rounded-lg divide-y divide-slate-200">
            {selectedLiveShows.map((s) => {
              const totals = getLiveShowTotals(s.id);
              return (
                <div key={s.id} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800">{s.show_number}</p>
                    <p className="text-xs text-slate-500">{s.show_date || '—'} {s.show_time || ''} • {s.location || 'N/A'}</p>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-slate-500">Balance</div>
                    <div className="font-semibold text-slate-800">{totals.balance.toFixed(2)}</div>
                  </div>
                </div>
              );
            })}
            {selectedLiveShows.length === 0 && <div className="p-4 text-center text-slate-500">No live shows selected</div>}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Issue Date</label>
            <input
              type="date"
              value={combinedIssueDate}
              onChange={(e) => onCombinedIssueDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
            <select
              value={combinedPaymentMethod}
              onChange={(e) => onCombinedPaymentMethodChange(e.target.value as 'cash' | 'transfer')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            >
              <option value="cash">Cash</option>
              <option value="transfer">Bank Transfer</option>
            </select>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
            <input
              type="checkbox"
              className="rounded border-slate-300"
              checked={combinedVatExempt}
              onChange={(e) => onCombinedVatExemptChange(e.target.checked)}
            />
            Remove VAT for this receipt
          </label>
        </div>
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
          <div>
            <p className="text-xs text-slate-500">Subtotal</p>
            <p className="text-base font-semibold text-slate-800">{combinedBalance.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Tax</p>
            <p className="text-base font-semibold text-slate-800">{taxAmount.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total</p>
            <p className="text-base font-semibold text-slate-800">{total.toFixed(2)}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
          <button
            onClick={onSubmit}
            className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            disabled={selectedLiveShows.length === 0 || hasMixedClients || combinedBalance <= 0}
          >
            Save & Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
