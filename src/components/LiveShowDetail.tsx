import { useEffect, useMemo, useState } from 'react';
import { supabaseHelpers, LiveShow, LiveShowQuotation, LiveShowPayment, Client } from '../lib/supabaseHelpers';

type Props = {
  liveShowId: string;
  onBack: () => void;
  onDeleted?: () => void;
};

export default function LiveShowDetail({ liveShowId, onBack, onDeleted }: Props) {
  const [show, setShow] = useState<LiveShow | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [quotations, setQuotations] = useState<LiveShowQuotation[]>([]);
  const [payments, setPayments] = useState<LiveShowPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [role, setRole] = useState<'admin' | 'manager' | 'sales' | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const s = await supabaseHelpers.getLiveShowById(liveShowId);
        if (!s) throw new Error('Live show not found');
        const [qs, ps] = await Promise.all([
          supabaseHelpers.getLiveShowQuotations(liveShowId),
          supabaseHelpers.getLiveShowPayments(liveShowId),
        ]);
        const c = await supabaseHelpers.getClientById(s.client_id);
        const r = await supabaseHelpers.getCurrentUserRole();
        if (!mounted) return;
        setShow(s);
        setQuotations(qs);
        setPayments(ps);
        setClient(c);
        setRole(r);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load live show');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [liveShowId]);

  const totals = useMemo(() => {
    const estimated = Math.max(0, Number(quotations[0]?.total_estimated || 0));
    const adv = payments.filter((p) => p.payment_type === 'advance').reduce((sum, p) => sum + Math.max(0, Number(p.amount || 0)), 0);
    const full = payments.filter((p) => p.payment_type === 'full').reduce((sum, p) => sum + Math.max(0, Number(p.amount || 0)), 0);
    const balance = Math.max(0, estimated - (adv + full));
    return { estimated, adv, full, balance };
  }, [quotations, payments]);

  function dateToInput(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function mergeDateIntoISO(originalIso: string | undefined, newDateStr: string): string {
    const base = originalIso ? new Date(originalIso) : new Date();
    const [yStr, mStr, dStr] = newDateStr.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    const next = new Date(base);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      next.setFullYear(y);
      next.setMonth(m - 1);
      next.setDate(d);
    }
    return next.toISOString();
  }

  function startEditPayment(p: LiveShowPayment) {
    setEditingPaymentId(p.id);
    setEditingDate(dateToInput(p.created_at));
    setError(null);
  }

  function cancelEdit() {
    setEditingPaymentId(null);
    setEditingDate('');
    setSavingEdit(false);
  }

  async function saveEdit(payment: LiveShowPayment) {
    if (!editingPaymentId || savingEdit) return;
    if (!editingDate) {
      setError('Please choose a date');
      return;
    }
    try {
      setSavingEdit(true);
      const newIso = mergeDateIntoISO(payment.created_at, editingDate);
      const updated = await supabaseHelpers.updateLiveShowPaymentDate(payment.id, newIso);
      setPayments((prev) => prev.map((pp) => (pp.id === payment.id ? { ...pp, created_at: updated.created_at } : pp)));
      cancelEdit();
    } catch (e: any) {
      setError(e?.message || 'Failed to update payment date');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete() {
    if (!show || deleting) return;
    const ok = window.confirm('Delete this live show and related records? This cannot be undone.');
    if (!ok) return;
    try {
      setDeleting(true);
      await supabaseHelpers.deleteLiveShow(show.id);
      if (onDeleted) onDeleted();
      onBack();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete live show');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <button onClick={onBack} className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 mb-4">Back</button>
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <button onClick={onBack} className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 mb-4">Back</button>
        <div className="text-red-600 text-sm">{error}</div>
      </div>
    );
  }

  if (!show) {
    return (
      <div className="p-4">
        <button onClick={onBack} className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 mb-4">Back</button>
        <div className="text-slate-600">No data</div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Live Show {show.show_number}</h1>
          <p className="text-slate-600 text-sm">ID: {show.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Back</button>
          <button onClick={handleDelete} disabled={deleting} className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">Delete</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
          <h2 className="font-semibold text-slate-700 mb-3">Details</h2>
          <div className="space-y-1 text-sm text-slate-700">
            <div className="flex justify-between"><span>Date</span><span className="font-medium">{show.show_date || '—'} {show.show_time || ''}</span></div>
            <div className="flex justify-between"><span>Location</span><span className="font-medium">{show.location || '—'}</span></div>
            <div className="flex justify-between"><span>Item</span><span className="font-medium">{show.item_name || '—'}</span></div>
            <div className="flex justify-between"><span>KG</span><span className="font-medium">{show.kg ?? '—'}</span></div>
            <div className="flex justify-between"><span>People</span><span className="font-medium">{show.people_count ?? '—'}</span></div>
            <div className="flex justify-between"><span>Status</span><span className="font-medium">{show.status}</span></div>
          </div>
          {show.notes && (
            <div className="mt-3 text-sm text-slate-700">
              <div className="text-slate-500 mb-1">Notes</div>
              <div className="whitespace-pre-line">{show.notes}</div>
            </div>
          )}
        </div>

        <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
          <h2 className="font-semibold text-slate-700 mb-3">Customer</h2>
          {client ? (
            <div className="space-y-1 text-sm text-slate-700">
              <p className="font-medium text-slate-800">{client.name}</p>
              {client.phone && <p>{client.phone}</p>}
              {client.email && <p>{client.email}</p>}
              {client.address && <p className="whitespace-pre-line">{client.address}</p>}
              {client.trn && <p>TRN: {client.trn}</p>}
              {client.emirate && <p>Emirate: {client.emirate}</p>}
            </div>
          ) : (
            <p className="text-sm text-slate-600">Customer details unavailable</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 border border-slate-200 rounded-lg">
          <h2 className="font-semibold text-slate-700 mb-3">Quotations</h2>
          <div className="space-y-2 text-sm">
            {quotations.length === 0 && <p className="text-slate-600">No quotations</p>}
            {quotations.map((q) => (
              <div key={q.id} className="p-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="font-medium">{q.quotation_number}</p>
                  {typeof q.total_estimated === 'number' && (
                    <p className="text-slate-600">Estimated: {Number(q.total_estimated).toFixed(2)}</p>
                  )}
                </div>
                <div className="text-xs text-slate-500">{q.created_at?.split('T')[0] || ''}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border border-slate-200 rounded-lg">
          <h2 className="font-semibold text-slate-700 mb-3">Payments</h2>
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="p-2 bg-slate-50 rounded border border-slate-200">
                <p className="text-xs text-slate-500">Advance</p>
                <p className="font-semibold">{totals.adv.toFixed(2)}</p>
              </div>
              <div className="p-2 bg-slate-50 rounded border border-slate-200">
                <p className="text-xs text-slate-500">Full</p>
                <p className="font-semibold">{totals.full.toFixed(2)}</p>
              </div>
              <div className="p-2 bg-slate-50 rounded border border-slate-200 col-span-2">
                <p className="text-xs text-slate-500">Balance</p>
                <p className="font-semibold">{totals.balance.toFixed(2)}</p>
              </div>
            </div>
            {payments.length === 0 && <p className="text-slate-600">No payments recorded</p>}
            {payments.map((p) => (
              <div key={p.id} className="p-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="font-medium capitalize">{p.payment_type}</p>
                  <p className="text-slate-600">Amount: {Number(p.amount).toFixed(2)} ({p.method})</p>
                </div>
                <div className="flex items-center gap-2">
                  {editingPaymentId === p.id ? (
                    <>
                      <input
                        type="date"
                        value={editingDate}
                        onChange={(e) => setEditingDate(e.target.value)}
                        className="text-xs border border-slate-300 rounded px-2 py-1"
                      />
                      <button
                        onClick={() => saveEdit(p)}
                        disabled={savingEdit}
                        className="text-xs px-2 py-1 bg-slate-800 text-white rounded disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="text-xs px-2 py-1 border border-slate-300 rounded"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="text-xs text-slate-500">{p.created_at?.split('T')[0] || ''}</div>
                      {p.payment_type === 'advance' && (role === 'admin' || role === 'manager') && (
                        <button
                          onClick={() => startEditPayment(p)}
                          className="text-xs px-2 py-1 border border-slate-300 rounded hover:bg-slate-100"
                        >
                          Edit date
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}