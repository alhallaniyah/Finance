import { useEffect, useMemo, useState } from 'react';
import { supabaseHelpers, LiveShow, LiveShowQuotation, LiveShowPayment } from '../lib/supabaseHelpers';
import { generateDocumentNumber } from '../lib/documentHelpers';

type Props = {
  onBack: () => void;
  onOpenDetail: (id: string) => void;
  onReceiptSaved?: (documentId: string, options?: { print?: boolean }) => void;
};

export default function LiveShowsAll({ onBack, onOpenDetail, onReceiptSaved }: Props) {
  const [shows, setShows] = useState<LiveShow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<{ show_date?: string | null; show_time?: string | null; location?: string | null; item_name?: string | null; kg?: number | null; people_count?: number | null; notes?: string | null; status?: LiveShow['status'] }>({});
  const [paymentShow, setPaymentShow] = useState<LiveShow | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<'advance' | 'full'>('advance');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data, total } = await supabaseHelpers.getLiveShowsPage(page, pageSize);
      setShows(data);
      setTotal(total);
    } catch (e: any) {
      setError(e?.message || 'Failed to load live shows');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page, pageSize]);

  function sumPayments(list: LiveShowPayment[], type?: 'advance' | 'full') {
    const arr = type ? list.filter((p) => p.payment_type === type) : list;
    return arr.reduce((sum, p) => sum + Math.max(0, Number(p.amount || 0)), 0);
  }

  async function createFullPaymentReceipt(show: LiveShow, amount: number, method: 'cash' | 'transfer', quotation: LiveShowQuotation | null, issueDate: string) {
    const docNumber = await generateDocumentNumber('invoice');
    const client = await supabaseHelpers.getClientById(show.client_id);
    const payments = await supabaseHelpers.getLiveShowPayments(show.id).catch(() => [] as LiveShowPayment[]);
    const estimated = Math.max(0, Number(quotation?.total_estimated || 0));
    const advancePaid = sumPayments(payments, 'advance');
    const fullPaid = sumPayments(payments, 'full');
    const balanceBefore = Math.max(0, estimated - (advancePaid + fullPaid - amount));
    const balanceAfter = Math.max(0, estimated - (advancePaid + fullPaid));

    const receiptDoc = await supabaseHelpers.createDocument({
      document_type: 'invoice',
      document_number: docNumber,
      client_id: client?.id || show.client_id,
      client_name: client?.name || '',
      client_email: client?.email || '',
      client_phone: client?.phone || '',
      client_address: client?.address || '',
      client_trn: (client as any)?.trn || '',
      client_emirate: client?.emirate || '',
      issue_date: issueDate || new Date().toISOString().split('T')[0],
      subtotal: amount,
      tax_amount: 0,
      discount_amount: 0,
      total: amount,
      notes: `Final Receipt for Live Show ${show.show_number}.\nEstimated: ${estimated.toFixed(2)}\nPaid this receipt: ${amount.toFixed(2)}\nBalance before: ${balanceBefore.toFixed(2)}\nBalance after: ${balanceAfter.toFixed(2)}`,
      terms: '',
      status: 'paid',
      origin: 'dashboard',
      payment_method: method,
      payment_card_amount: 0,
      payment_cash_amount: method === 'cash' ? amount : 0,
      delivery_fee: 0,
      delivery_provider_id: null,
    });

    try {
      await supabaseHelpers.createDocumentItem({
        document_id: receiptDoc.id,
        description: `Full Payment (${show.show_number})`,
        quantity: 1,
        weight: 0,
        sell_by: 'unit',
        item_id: null,
        unit_price: amount,
        amount,
      });
    } catch (e) {
      console.warn('Failed to attach payment item to receipt', e);
    }

    return receiptDoc;
  }

  const maxPage = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  function startEdit(s: LiveShow) {
    setEditingId(s.id);
    setEditState({
      show_date: s.show_date ?? '',
      show_time: s.show_time ?? '',
      location: s.location ?? '',
      item_name: s.item_name ?? '',
      kg: typeof s.kg === 'number' ? s.kg : null,
      people_count: typeof s.people_count === 'number' ? s.people_count : null,
      notes: s.notes ?? '',
      status: s.status,
    });
  }

  async function openPayment(s: LiveShow, type?: 'advance' | 'full') {
    const resolvedType: 'advance' | 'full' = type || (s.status === 'advanced_paid' ? 'full' : 'advance');
    setPaymentShow(s);
    setPaymentType(resolvedType);
    setPaymentAmount(0);
    setPaymentMethod('cash');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentError(null);

    if (resolvedType === 'full') {
      try {
        const [qs, ps] = await Promise.all([
          supabaseHelpers.getLiveShowQuotations(s.id),
          supabaseHelpers.getLiveShowPayments(s.id),
        ]);
        const estimated = Math.max(0, Number(qs[0]?.total_estimated || 0));
        const balance = Math.max(0, estimated - (sumPayments(ps, 'advance') + sumPayments(ps, 'full')));
        setPaymentAmount(balance);
      } catch (e) {
        console.warn('Failed to preload full payment amount', e);
      }
    }
  }

  async function submitPayment() {
    if (!paymentShow) return;
    const amt = Math.max(0, Number(paymentAmount || 0));
    if (amt <= 0) {
      setPaymentError('Enter a valid amount greater than 0.');
      return;
    }
    setSavingPayment(true);
    setPaymentError(null);
    try {
      const qs = await supabaseHelpers.getLiveShowQuotations(paymentShow.id);
      const q = qs.length > 0 ? qs[0] : null;
      const payment = await supabaseHelpers.recordLiveShowPayment(paymentShow.id, {
        type: paymentType,
        amount: amt,
        method: paymentMethod,
        quotation_id: q?.id || null,
      });

      // Align DB payment date to selected paymentDate (ISO date)
      const iso = `${paymentDate}T12:00:00Z`;
      try { await supabaseHelpers.updateLiveShowPaymentDate(payment.id, iso); } catch {}

      // Create the printable receipt with the selected payment date
      const doc = paymentType === 'advance'
        ? await supabaseHelpers.createAdvanceReceiptForLiveShow(paymentShow.id, {
            amount: amt,
            method: paymentMethod,
            issueDate: paymentDate,
          })
        : await createFullPaymentReceipt(paymentShow, amt, paymentMethod, q, paymentDate);

      // Trigger Save & Print flow in parent
      if (onReceiptSaved) onReceiptSaved(doc.id, { print: true });

      setPaymentShow(null);
      await load();
    } catch (e: any) {
      setPaymentError(e?.message || 'Failed to record payment');
    } finally {
      setSavingPayment(false);
    }
  }

  async function saveEdit() {
    if (!editingId) return;
    try {
      await supabaseHelpers.updateLiveShow(editingId, {
        show_date: editState.show_date || null,
        show_time: editState.show_time || null,
        location: editState.location || null,
        item_name: editState.item_name || null,
        kg: typeof editState.kg === 'number' ? editState.kg : null,
        people_count: typeof editState.people_count === 'number' ? editState.people_count : null,
        notes: editState.notes || null,
        status: editState.status,
      });
      setEditingId(null);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to save changes');
    }
  }

  async function deleteShow(id: string) {
    const ok = window.confirm('Delete this live show and related records?');
    if (!ok) return;
    try {
      await supabaseHelpers.deleteLiveShow(id);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete live show');
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-slate-800">All Live Shows</h1>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Back</button>
          <button onClick={load} className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Refresh</button>
        </div>
      </div>

      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="text-slate-600">Loading...</div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-300">
                <th className="text-left py-2 px-3">ID</th>
                <th className="text-left py-2 px-3">Number</th>
                <th className="text-left py-2 px-3">Date</th>
                <th className="text-left py-2 px-3">Time</th>
                <th className="text-left py-2 px-3">Location</th>
                <th className="text-left py-2 px-3">Item</th>
                <th className="text-left py-2 px-3">KG</th>
                <th className="text-left py-2 px-3">People</th>
                <th className="text-left py-2 px-3">Status</th>
                <th className="text-right py-2 px-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shows.map((s) => (
                <tr key={s.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2 text-xs text-slate-500">
                    <button className="underline hover:text-blue-600" onClick={() => onOpenDetail(s.id)}>{s.id}</button>
                  </td>
                  <td className="px-3 py-2 font-medium">{s.show_number}</td>
                  <td className="px-3 py-2">{s.show_date || '—'}</td>
                  <td className="px-3 py-2">{s.show_time || '—'}</td>
                  <td className="px-3 py-2">{s.location || '—'}</td>
                  <td className="px-3 py-2">{s.item_name || '—'}</td>
                  <td className="px-3 py-2">{typeof s.kg === 'number' ? s.kg : '—'}</td>
                  <td className="px-3 py-2">{typeof s.people_count === 'number' ? s.people_count : '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-1 rounded-full text-[11px] font-medium ${
                      s.status === 'quotation' ? 'bg-yellow-100 text-yellow-700' :
                      s.status === 'advanced_paid' ? 'bg-blue-100 text-blue-700' :
                      s.status === 'fully_paid' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>{s.status}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button onClick={() => startEdit(s)} className="text-xs px-2 py-1 border border-slate-200 rounded hover:bg-slate-50">Edit</button>
                      <button onClick={() => deleteShow(s.id)} className="text-xs px-2 py-1 border border-red-200 text-red-700 rounded hover:bg-red-50">Delete</button>
                      {s.status !== 'fully_paid' && s.status !== 'cancelled' && (
                        <button
                          onClick={() => openPayment(s)}
                          className={`text-xs px-3 py-1 text-white rounded hover:brightness-95 ${
                            s.status === 'advanced_paid' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          {s.status === 'advanced_paid' ? 'Record Full Payment' : 'Record Advance'}
                        </button>
                      )}
                      {s.status === 'fully_paid' && <span className="text-xs text-emerald-700">Completed</span>}
                      {s.status === 'cancelled' && <span className="text-xs text-slate-500">Cancelled</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 mt-3">
        <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">Prev</button>
        <div className="text-sm text-slate-600">Page {page} / {maxPage}</div>
        <button disabled={page >= maxPage} onClick={() => setPage((p) => Math.min(maxPage, p + 1))} className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">Next</button>
      </div>

      {editingId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white w-[90vw] max-w-2xl rounded-xl shadow-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Edit Live Show</h3>
              <button onClick={() => setEditingId(null)} className="p-2 hover:bg-slate-50 rounded-lg">✕</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                <input type="date" value={editState.show_date || ''} onChange={(e) => setEditState((st) => ({ ...st, show_date: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Time</label>
                <input type="time" value={editState.show_time || ''} onChange={(e) => setEditState((st) => ({ ...st, show_time: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
                <input type="text" value={editState.location || ''} onChange={(e) => setEditState((st) => ({ ...st, location: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Item</label>
                <input type="text" value={editState.item_name || ''} onChange={(e) => setEditState((st) => ({ ...st, item_name: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">KG</label>
                <input type="number" step="0.01" value={typeof editState.kg === 'number' ? editState.kg : 0} onChange={(e) => setEditState((st) => ({ ...st, kg: parseFloat(e.target.value) }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">People</label>
                <input type="number" value={typeof editState.people_count === 'number' ? editState.people_count : 0} onChange={(e) => setEditState((st) => ({ ...st, people_count: parseInt(e.target.value || '0', 10) }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <textarea value={editState.notes || ''} onChange={(e) => setEditState((st) => ({ ...st, notes: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select value={editState.status || 'quotation'} onChange={(e) => setEditState((st) => ({ ...st, status: e.target.value as LiveShow['status'] }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                  <option value="quotation">Quotation</option>
                  <option value="advanced_paid">Advanced Paid</option>
                  <option value="fully_paid">Fully Paid</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button onClick={() => setEditingId(null)} className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={saveEdit} className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentShow && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white w-[90vw] max-w-md rounded-xl shadow-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">
                {paymentType === 'advance' ? 'Record Advance Payment' : 'Record Full Payment'}
              </h3>
              <button onClick={() => setPaymentShow(null)} className="p-2 hover:bg-slate-50 rounded-lg">✕</button>
            </div>
            <div className="text-sm text-slate-700 mb-3">
              <p className="mb-1"><span className="font-semibold">Live Show:</span> {paymentShow.show_number}</p>
              <p className="mb-1"><span className="font-semibold">Date:</span> {paymentShow.show_date || '—'}{paymentShow.show_time ? ` at ${paymentShow.show_time}` : ''}</p>
              <p className="mb-2"><span className="font-semibold">Location:</span> {paymentShow.location || '—'}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Amount</label>
                <input type="number" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(parseFloat(e.target.value || '0'))} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Payment Date</label>
                <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'transfer')} className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                  <option value="cash">Cash</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
              {paymentError && <div className="text-sm text-red-600">{paymentError}</div>}
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button onClick={() => setPaymentShow(null)} className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={submitPayment} disabled={savingPayment} className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                {paymentType === 'advance' ? 'Save Advance Payment' : 'Save Full Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
