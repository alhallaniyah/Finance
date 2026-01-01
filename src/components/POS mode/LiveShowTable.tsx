import { Trash2 } from 'lucide-react';
import { LiveShow, LiveShowPayment, LiveShowQuotation } from '../../lib/supabaseHelpers';

type LiveShowTableProps = {
  liveShows: LiveShow[];
  liveShowsLoading: boolean;
  paymentsMap: Record<string, LiveShowPayment[]>;
  quotationsMap: Record<string, LiveShowQuotation[]>;
  selectedLiveShowIds: string[];
  onToggleSelectAll: (onPageOnly?: boolean) => void;
  onToggleSelection: (id: string) => void;
  onOpenPaymentModal: (show: LiveShow, type: 'advance' | 'full') => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  lsPage: number;
  lsTotal: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onOpenCombinedReceipt: () => void;
  combinedBalance: number;
  hasMixedClients: boolean;
  selectedCount: number;
};

function sumPayments(payments: LiveShowPayment[], type?: 'advance' | 'full') {
  const list = type ? payments.filter((p) => p.payment_type === type) : payments;
  return list.reduce((sum, p) => sum + Math.max(0, Number(p.amount || 0)), 0);
}

export function LiveShowTable({
  liveShows,
  liveShowsLoading,
  paymentsMap,
  quotationsMap,
  selectedLiveShowIds,
  onToggleSelectAll,
  onToggleSelection,
  onOpenPaymentModal,
  onDelete,
  onRefresh,
  lsPage,
  lsTotal,
  pageSize,
  onPageChange,
  onOpenCombinedReceipt,
  combinedBalance,
  hasMixedClients,
  selectedCount,
}: LiveShowTableProps) {
  const totalPages = Math.max(1, Math.ceil(lsTotal / pageSize));

  return (
    <div className="border-t border-slate-200 pt-4 mt-4">
      <div className="flex items-center justify-between mb-2 gap-2">
        <h3 className="text-sm font-semibold text-slate-700">Existing Live Shows</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenCombinedReceipt}
            className="text-xs px-3 py-1 bg-slate-800 text-white rounded hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={selectedCount < 2 || hasMixedClients || combinedBalance <= 0}
            title="Generate one receipt for selected live shows (same customer)"
          >
            Combined Receipt
          </button>
          <button
            onClick={onRefresh}
            className="text-xs px-2 py-1 border border-slate-200 rounded hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>
      {liveShowsLoading ? (
        <div className="text-sm text-slate-500">Loading live shows…</div>
      ) : liveShows.length === 0 ? (
        <div className="text-sm text-slate-500">No live shows yet</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="text-left px-3 py-2 border-b w-10">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={liveShows.length > 0 && liveShows.every((s) => selectedLiveShowIds.includes(s.id))}
                    onChange={() => onToggleSelectAll(true)}
                  />
                </th>
                <th className="text-left px-3 py-2 border-b">ID</th>
                <th className="text-left px-3 py-2 border-b">Show #</th>
                <th className="text-left px-3 py-2 border-b">Date</th>
                <th className="text-left px-3 py-2 border-b">Time</th>
                <th className="text-left px-3 py-2 border-b">Location</th>
                <th className="text-left px-3 py-2 border-b">Status</th>
                <th className="text-right px-3 py-2 border-b">Estimated</th>
                <th className="text-right px-3 py-2 border-b">Advance Paid</th>
                <th className="text-right px-3 py-2 border-b">Full Paid</th>
                <th className="text-right px-3 py-2 border-b">Balance</th>
                <th className="text-left px-3 py-2 border-b">Actions</th>
              </tr>
            </thead>
            <tbody className="text-slate-800">
              {liveShows.map((s) => {
                const payments = paymentsMap[s.id] || [];
                const qs = quotationsMap[s.id] || [];
                const estimated = Math.max(0, Number(qs[0]?.total_estimated || 0));
                const adv = sumPayments(payments, 'advance');
                const full = sumPayments(payments, 'full');
                const balance = Math.max(0, estimated - (adv + full));
                return (
                  <tr key={s.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        checked={selectedLiveShowIds.includes(s.id)}
                        onChange={() => onToggleSelection(s.id)}
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{s.id}</td>
                    <td className="px-3 py-2 font-medium">{s.show_number}</td>
                    <td className="px-3 py-2">{s.show_date || '—'}</td>
                    <td className="px-3 py-2">{s.show_time || '—'}</td>
                    <td className="px-3 py-2">{s.location}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded-full text-[11px] font-medium ${
                        s.status === 'quotation' ? 'bg-yellow-100 text-yellow-700' :
                        s.status === 'advanced_paid' ? 'bg-blue-100 text-blue-700' :
                        s.status === 'fully_paid' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-slate-200 text-slate-700'
                      }`}>{s.status.replace('_', ' ')}</span>
                    </td>
                    <td className="px-3 py-2 text-right">{estimated.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{adv.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{full.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{balance.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {s.status === 'quotation' && (
                          <button
                            onClick={() => onOpenPaymentModal(s, 'advance')}
                            className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Record Advance
                          </button>
                        )}
                        {s.status === 'advanced_paid' && (
                          <button
                            onClick={() => onOpenPaymentModal(s, 'full')}
                            className="text-xs px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                          >
                            Record Full Payment
                          </button>
                        )}
                        {s.status === 'fully_paid' && (
                          <span className="text-xs text-emerald-700">Completed</span>
                        )}
                        <button
                          onClick={() => onDelete(s.id)}
                          className="text-xs px-2 py-1 border border-red-200 text-red-700 rounded hover:bg-red-50 inline-flex items-center gap-1"
                          title="Delete Live Show"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-2 py-2 border border-t-0 border-slate-200 rounded-b-lg bg-slate-50">
            <div className="text-xs text-slate-600">Page {lsPage} of {totalPages} — {lsTotal} total</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPageChange(Math.max(1, lsPage - 1))}
                disabled={lsPage <= 1}
                className={`text-xs px-2 py-1 rounded border ${lsPage <= 1 ? 'border-slate-200 text-slate-300 cursor-not-allowed' : 'border-slate-200 text-slate-700 hover:bg-white'}`}
              >
                Prev
              </button>
              <button
                onClick={() => onPageChange(Math.min(totalPages, lsPage + 1))}
                disabled={lsPage >= totalPages}
                className={`text-xs px-2 py-1 rounded border ${lsPage >= totalPages ? 'border-slate-200 text-slate-300 cursor-not-allowed' : 'border-slate-200 text-slate-700 hover:bg-white'}`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
