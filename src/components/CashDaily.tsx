import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, RefreshCcw, Save } from 'lucide-react';
import { Account, CashDailyBalance, supabaseHelpers } from '../lib/supabaseHelpers';

type CashDailyProps = {
  onBack: () => void;
};

export default function CashDaily({ onBack }: CashDailyProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<CashDailyBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [accountId, setAccountId] = useState('');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [opening, setOpening] = useState('');
  const [closing, setClosing] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [accs, bal] = await Promise.all([
        supabaseHelpers.getAccounts(),
        supabaseHelpers.getCashDailyBalances(),
      ]);
      const cashAcc = accs.find((a) => a.type === 'cash' || a.type === 'petty_cash');
      setAccounts(accs);
      if (cashAcc && !accountId) setAccountId(cashAcc.id);
      setEntries(bal);
    } catch (e: any) {
      setError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  const difference = useMemo(() => {
    if (closing === '') return null;
    const open = Number(opening) || 0;
    const close = Number(closing);
    if (Number.isNaN(close)) return null;
    return Number((close - open).toFixed(2));
  }, [opening, closing]);

  async function saveEntry() {
    if (!accountId) {
      setError('Select a cash account');
      return;
    }
    if (!entryDate) {
      setError('Date is required');
      return;
    }
    if (!opening || isNaN(Number(opening))) {
      setError('Opening amount is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await supabaseHelpers.upsertCashDailyBalance({
        account_id: accountId,
        entry_date: entryDate,
        opening_amount: Number(opening),
        closing_amount: closing !== '' ? Number(closing) : null,
        notes: notes || null,
      });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-2xl font-bold text-slate-800">Daily Cash</h1>
          <button onClick={load} className="ml-auto p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
            <RefreshCcw className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Record Opening / Closing</h2>
              <p className="text-sm text-slate-600">One entry per cash or petty cash account per day.</p>
            </div>
            <button
              onClick={saveEntry}
              disabled={saving}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Entry
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Date</label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Cash Account</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select account</option>
                {accounts
                  .filter((a) => a.type === 'cash' || a.type === 'petty_cash')
                  .map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Opening amount</label>
              <input
                type="number"
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Closing amount</label>
              <input
                type="number"
                value={closing}
                onChange={(e) => setClosing(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Difference</label>
              <div className={`px-3 py-2 border rounded-lg ${difference === null ? 'text-slate-700' : difference > 0 ? 'text-emerald-700' : difference < 0 ? 'text-red-700' : 'text-slate-700'}`}>
                {difference === null ? '—' : difference.toFixed(2)}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-600 mb-1">Notes</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Count sheet or remarks"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Recent Entries</h2>
              <p className="text-sm text-slate-600">Last 30 days, newest first.</p>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Account</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Opening</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Closing</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Difference</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-800">{entry.entry_date}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {accounts.find((a) => a.id === entry.account_id)?.name || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{Number(entry.opening_amount ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-slate-700">{entry.closing_amount != null ? Number(entry.closing_amount).toFixed(2) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${Number(entry.difference || 0) === 0 ? 'bg-slate-100 text-slate-700' : (Number(entry.difference || 0) > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}`}>
                          {entry.difference != null ? Number(entry.difference).toFixed(2) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{entry.notes || '—'}</td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-600">
                        No entries yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
