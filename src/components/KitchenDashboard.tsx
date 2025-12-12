import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Timer, CheckCircle, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { supabaseHelpers, KitchenBatch } from '../lib/supabaseHelpers';

type KitchenDashboardProps = {
  onBack: () => void;
  onStartNewBatch: () => void;
  onRunBatch: (batch: KitchenBatch) => void;
  onValidateBatch: (batch: KitchenBatch) => void;
};

export default function KitchenDashboard({ onBack, onStartNewBatch, onRunBatch, onValidateBatch }: KitchenDashboardProps) {
  const [batches, setBatches] = useState<KitchenBatch[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'manager' | 'sales' | null>(null);
  const [showError, setShowError] = useState(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const role = await supabaseHelpers.getCurrentUserRole();
        if (mounted) setUserRole(role);
      } catch (e) {
        console.warn('Failed to load user role', e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function load() {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    setShowError(false);
    errorTimerRef.current = setTimeout(() => setShowError(true), 10_000); // allow slow connections to resolve
    setLoading(true);
    setError(null);
    try {
      const { data, total } = await supabaseHelpers.getKitchenBatchesPage(page, pageSize);
      setBatches(data);
      setTotal(total);
    } catch (e: any) {
      setError(e?.message || 'Failed to load batches');
    } finally {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
        errorTimerRef.current = null;
      }
      setShowError(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
        errorTimerRef.current = null;
      }
    };
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function statusBadge(status: KitchenBatch['status'], validation?: KitchenBatch['validation_status']) {
    const base = 'inline-block px-3 py-1 rounded-full text-xs font-medium';
    if (status === 'in_progress') return <span className={`${base} bg-blue-100 text-blue-700`}>In Progress</span>;
    if (status === 'completed') return <span className={`${base} bg-slate-100 text-slate-700`}>Completed</span>;
    if (status === 'validated') {
      const v = validation || 'moderate';
      if (v === 'good') return <span className={`${base} bg-emerald-100 text-emerald-700`}>Validated: Good</span>;
      if (v === 'moderate') return <span className={`${base} bg-amber-100 text-amber-700`}>Validated: Moderate</span>;
      return <span className={`${base} bg-red-100 text-red-700`}>Validated: Shift Detected</span>;
    }
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto p-3 sm:p-5">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200 hover:border-slate-300" title="Back">
              <ArrowLeft className="w-5 h-5 text-slate-700" />
            </button>
            <h1 className="text-lg md:text-2xl font-bold text-slate-800">Kitchen Stopwatch</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onStartNewBatch}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700"
            >
              <Timer className="w-5 h-5" /> Start New Batch
            </button>
            <button
              onClick={async () => { try { await supabase.auth.signOut(); } catch (e) { console.error('Sign out failed', e); } }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white text-slate-700 border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" /> Sign Out
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : error && showError ? (
          <div className="bg-white rounded-xl p-6 border border-red-200 text-red-700">{error}</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Halwa</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Starch (kg)</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Start</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">End</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Total (min)</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {batches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{b.halwa_type}</td>
                    <td className="px-4 py-3">{Number(b.starch_weight)}</td>
                    <td className="px-4 py-3 text-slate-600">{b.start_time ? new Date(b.start_time).toLocaleString() : '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{b.end_time ? new Date(b.end_time).toLocaleString() : '-'}</td>
                    <td className="px-4 py-3">{b.total_duration ? Number(b.total_duration).toFixed(2) : '-'}</td>
                    <td className="px-4 py-3">{statusBadge(b.status, b.validation_status)}</td>
                  <td className="px-4 py-3 text-right">
                    {b.status === 'in_progress' && (
                      <button className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700" onClick={() => onRunBatch(b)}>Resume</button>
                    )}
                    {b.status !== 'in_progress' && (
                      <button className="px-3 py-1.5 text-sm bg-slate-600 text-white rounded-lg hover:bg-slate-700 ml-2" onClick={() => onRunBatch(b)}>View</button>
                    )}
                    {(userRole === 'admin' || userRole === 'manager') && b.status !== 'validated' && (
                      <button className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 ml-2" onClick={() => onValidateBatch(b)}>
                        Validate
                      </button>
                    )}
                    {(userRole === 'admin' || userRole === 'manager') && b.status === 'validated' && (
                      <div className="w-full flex flex-col items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1 text-emerald-700 text-sm"><CheckCircle className="w-4 h-4" />Validated</span>
                        <button className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 shadow-sm" onClick={() => onValidateBatch(b)}>
                          View Report
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
            <div className="px-4 py-3 flex justify-between items-center border-t border-slate-200 bg-slate-50">
              <div className="text-sm text-slate-600">Page {page} of {totalPages}</div>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg disabled:opacity-50">Prev</button>
                <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg disabled:opacity-50">Next</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
