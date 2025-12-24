import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Edit3, Loader2, Plus, RefreshCcw, Save, X } from 'lucide-react';
import { Account, AccountType, supabaseHelpers } from '../lib/supabaseHelpers';

type AccountsProps = {
  onBack: () => void;
};

const accountTypes: Array<{ value: AccountType; label: string }> = [
  { value: 'bank', label: 'Bank' },
  { value: 'cash', label: 'Cash' },
  { value: 'petty_cash', label: 'Petty Cash' },
  { value: 'employee', label: 'Employee-held' },
  { value: 'credit_card', label: 'Credit Card' },
];

export default function Accounts({ onBack }: AccountsProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [currency, setCurrency] = useState('AED');
  const [openingBalance, setOpeningBalance] = useState('');
  const [notes, setNotes] = useState('');

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await supabaseHelpers.getAccounts();
      setAccounts(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName('');
    setType('bank');
    setCurrency('AED');
    setOpeningBalance('');
    setNotes('');
    setEditingId(null);
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    const opening = openingBalance ? Number(openingBalance) : undefined;
    if (openingBalance && isNaN(Number(openingBalance))) {
      setError('Opening balance must be a number');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await supabaseHelpers.updateAccount(editingId, {
          name: name.trim(),
          type,
          currency,
          notes: notes.trim() || null,
        });
      } else {
        await supabaseHelpers.createAccount({
          name: name.trim(),
          type,
          currency,
          opening_balance: opening,
          notes: notes.trim() || null,
        });
      }
      resetForm();
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to save account');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(acc: Account) {
    setEditingId(acc.id);
    setName(acc.name || '');
    setType(acc.type);
    setCurrency(acc.currency || 'AED');
    setNotes(acc.notes || '');
  }

  async function toggleActive(acc: Account) {
    setSaving(true);
    try {
      await supabaseHelpers.updateAccount(acc.id, { is_active: !acc.is_active });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to update account');
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return accounts;
    return accounts.filter((a) => (a.name || '').toLowerCase().includes(term) || (a.type || '').toLowerCase().includes(term));
  }, [accounts, searchTerm]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-2xl font-bold text-slate-800">Accounts</h1>
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
              <h2 className="text-lg font-semibold text-slate-800">{editingId ? 'Edit Account' : 'Add Account'}</h2>
              <p className="text-sm text-slate-600">Bank, cash, petty cash, employee, or credit card accounts.</p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {editingId ? 'Save Changes' : 'Add Account'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-600 mb-1">Name</label>
              <input
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Main bank account"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Type</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={type}
                onChange={(e) => setType(e.target.value as AccountType)}
              >
                {accountTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Currency</label>
              <input
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="AED"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Opening Balance</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-600 mb-1">Notes</label>
              <input
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Usage, limits, etc."
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Accounts Directory</h2>
              <p className="text-sm text-slate-600">Used for expenses, reimbursements, and petty cash.</p>
            </div>
            <input
              type="text"
              placeholder="Search accounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
            />
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Currency</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Balance</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.map((acc) => (
                    <tr key={acc.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        {editingId === acc.id ? (
                          <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 rounded"
                          />
                        ) : (
                          <span className="font-medium text-slate-800">{acc.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === acc.id ? (
                          <select
                            value={type}
                            onChange={(e) => setType(e.target.value as AccountType)}
                            className="w-full px-2 py-1 border border-slate-200 rounded"
                          >
                            {accountTypes.map((t) => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-slate-700 capitalize">{acc.type.replace('_', ' ')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === acc.id ? (
                          <input
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 rounded"
                          />
                        ) : (
                          <span className="text-slate-700">{acc.currency || 'AED'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-800">
                        {Number(acc.current_balance ?? 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium ${acc.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                          {acc.is_active ? <Check className="w-3 h-3" /> : null}
                          {acc.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {editingId === acc.id ? (
                            <>
                              <button
                                onClick={handleSubmit}
                                disabled={saving}
                                className="p-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => resetForm()}
                                className="p-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(acc)}
                                className="p-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => toggleActive(acc)}
                                disabled={saving}
                                className={`p-2 rounded ${acc.is_active ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'} disabled:opacity-50`}
                              >
                                {acc.is_active ? 'Disable' : 'Enable'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
