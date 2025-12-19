import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BadgeCheck, CalendarClock, Edit3, Filter, Loader2, RefreshCcw, Save, Search, ShieldAlert, Wallet, X } from 'lucide-react';
import { supabaseHelpers, Expense, ExpensePageFilters, ExpenseReimbursementStatus, Vendor, Account, ExpenseApprovalStatus } from '../lib/supabaseHelpers';
import { formatCurrency } from '../lib/documentHelpers';

type ExpensesProps = {
  onBack: () => void;
};

type ExpenseForm = {
  expense_date: string;
  vendor_id: string;
  gross_amount: string;
  net_amount: string;
  vat_amount: string;
  vat_rate: string;
  vat_recoverable: boolean;
  currency: string;
  category: string;
  subcategory: string;
  business_purpose: string;
  account_id: string;
  paid_by: 'company' | 'employee';
  employee_user_id: string;
  reimbursement_status: ExpenseReimbursementStatus;
  approval_status: ExpenseApprovalStatus;
  is_backfilled: boolean;
};

const defaultForm = (): ExpenseForm => ({
  expense_date: new Date().toISOString().slice(0, 10),
  vendor_id: '',
  gross_amount: '',
  net_amount: '',
  vat_amount: '',
  vat_rate: '5',
  vat_recoverable: true,
  currency: 'AED',
  category: '',
  subcategory: '',
  business_purpose: '',
  account_id: '',
  paid_by: 'company',
  employee_user_id: '',
  reimbursement_status: 'not_required',
  approval_status: 'submitted',
  is_backfilled: false,
});

export default function Expenses({ onBack }: ExpensesProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<ExpensePageFilters>({
    sortColumn: 'expense_date',
    sortDirection: 'desc',
    isBackfilled: 'all',
    paidBy: 'all',
    approvalStatus: 'all',
    reimbursementStatus: 'all',
  });
  const [form, setForm] = useState<ExpenseForm>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const pageSize = 10;

  useEffect(() => {
    loadReferenceData();
  }, []);

  useEffect(() => {
    loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters]);

  async function loadReferenceData() {
    try {
      const [vList, aList] = await Promise.all([
        supabaseHelpers.getVendors(),
        supabaseHelpers.getAccounts(),
      ]);
      setVendors(vList);
      setAccounts(aList);
    } catch (e: any) {
      setError(e?.message || 'Failed to load reference data');
    }
  }

  async function loadExpenses() {
    setLoading(true);
    setError(null);
    try {
      const { data, total } = await supabaseHelpers.getExpensesPage(page, pageSize, filters);
      setExpenses(data);
      setTotal(total);
    } catch (e: any) {
      setError(e?.message || 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(expense: Expense) {
    setEditingId(expense.id);
    setForm({
      expense_date: expense.expense_date || new Date().toISOString().slice(0, 10),
      vendor_id: expense.vendor_id || '',
      gross_amount: expense.gross_amount != null ? String(expense.gross_amount) : '',
      net_amount: expense.net_amount != null ? String(expense.net_amount) : '',
      vat_amount: expense.vat_amount != null ? String(expense.vat_amount) : '',
      vat_rate: expense.vat_rate != null ? String(expense.vat_rate) : '',
      vat_recoverable: Boolean(expense.vat_recoverable),
      currency: expense.currency || 'AED',
      category: expense.category || '',
      subcategory: expense.subcategory || '',
      business_purpose: expense.business_purpose || '',
      account_id: expense.account_id || '',
      paid_by: expense.paid_by || 'company',
      employee_user_id: expense.employee_user_id || '',
      reimbursement_status: expense.reimbursement_status || 'not_required',
      approval_status: expense.approval_status || 'submitted',
      is_backfilled: Boolean(expense.is_backfilled),
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(defaultForm());
  }

  async function handleSave() {
    if (!form.expense_date) {
      setError('Expense date is required');
      return;
    }
    if (!form.gross_amount || isNaN(Number(form.gross_amount))) {
      setError('Gross amount is required');
      return;
    }
    const payload = {
      expense_date: form.expense_date,
      vendor_id: form.vendor_id || null,
      gross_amount: Number(form.gross_amount),
      net_amount: form.net_amount ? Number(form.net_amount) : Number(form.gross_amount),
      vat_amount: form.vat_amount ? Number(form.vat_amount) : 0,
      vat_rate: form.vat_rate ? Number(form.vat_rate) : 0,
      vat_recoverable: form.vat_recoverable,
      currency: form.currency || 'AED',
      category: form.category || undefined,
      subcategory: form.subcategory || undefined,
      business_purpose: form.business_purpose || undefined,
      account_id: form.account_id || null,
      paid_by: form.paid_by,
      employee_user_id: form.employee_user_id || null,
      reimbursement_status: form.reimbursement_status,
      approval_status: form.approval_status,
      is_backfilled: form.is_backfilled,
    };
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await supabaseHelpers.updateExpense(editingId, payload as any);
      } else {
        await supabaseHelpers.createExpense(payload as any);
      }
      resetForm();
      await loadExpenses();
    } catch (e: any) {
      setError(e?.message || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  }

  function vendorName(id?: string | null) {
    if (!id) return '—';
    return vendors.find((v) => v.id === id)?.name || '—';
  }

  function accountName(id?: string | null) {
    if (!id) return '—';
    return accounts.find((a) => a.id === id)?.name || '—';
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const backfilledCount = useMemo(() => expenses.filter((e) => e.is_backfilled).length, [expenses]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-2xl font-bold text-slate-800">Expenses</h1>
          <span className="ml-2 px-2 py-1 rounded-full bg-slate-100 text-xs text-slate-700">{total} total</span>
          {backfilledCount > 0 && (
            <span className="px-2 py-1 rounded-full bg-amber-100 text-xs text-amber-800">
              {backfilledCount} backfilled
            </span>
          )}
          <button onClick={loadExpenses} className="ml-auto p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
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
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-blue-600" />
                {editingId ? 'Edit Expense' : 'Record Expense'}
              </h2>
              <p className="text-sm text-slate-600">Capture date, vendor, amounts, and backfill flag.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={resetForm}
                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Clear
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingId ? 'Save Changes' : 'Save Expense'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Expense Date</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={form.expense_date}
                onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Vendor</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={form.vendor_id}
                onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
              >
                <option value="">Select vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Account</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={form.account_id}
                onChange={(e) => setForm({ ...form, account_id: e.target.value })}
              >
                <option value="">Select account</option>
                {accounts.filter((a) => a.is_active !== false).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Paid By</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={form.paid_by}
                onChange={(e) => setForm({ ...form, paid_by: e.target.value as 'company' | 'employee' })}
              >
                <option value="company">Company</option>
                <option value="employee">Employee</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Gross Amount</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={form.gross_amount}
                onChange={(e) => setForm({ ...form, gross_amount: e.target.value })}
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Net Amount</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={form.net_amount}
                onChange={(e) => setForm({ ...form, net_amount: e.target.value })}
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">VAT Amount</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={form.vat_amount}
                onChange={(e) => setForm({ ...form, vat_amount: e.target.value })}
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">VAT Rate %</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={form.vat_rate}
                onChange={(e) => setForm({ ...form, vat_rate: e.target.value })}
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Category</label>
              <input
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Rent"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Subcategory</label>
              <input
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={form.subcategory}
                onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
                placeholder="e.g. Warehouse"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-600 mb-1">Business Purpose</label>
              <input
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={form.business_purpose}
                onChange={(e) => setForm({ ...form, business_purpose: e.target.value })}
                placeholder="Why was this expense incurred?"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-600">VAT Recoverable</label>
              <button
                type="button"
                onClick={() => setForm({ ...form, vat_recoverable: !form.vat_recoverable })}
                className={`px-3 py-2 rounded-lg border text-sm ${form.vat_recoverable ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-slate-100 border-slate-200 text-slate-700'}`}
              >
                {form.vat_recoverable ? 'Yes' : 'No'}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-600">Backfilled</label>
              <button
                type="button"
                onClick={() => setForm({ ...form, is_backfilled: !form.is_backfilled })}
                className={`px-3 py-2 rounded-lg border text-sm ${form.is_backfilled ? 'bg-amber-100 border-amber-200 text-amber-800' : 'bg-slate-100 border-slate-200 text-slate-700'}`}
              >
                {form.is_backfilled ? 'Yes' : 'No'}
              </button>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Approval Status</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={form.approval_status}
                onChange={(e) => setForm({ ...form, approval_status: e.target.value as ExpenseApprovalStatus })}
              >
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="locked">Locked</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Reimbursement Status</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={form.reimbursement_status}
                onChange={(e) => setForm({ ...form, reimbursement_status: e.target.value as ExpenseReimbursementStatus })}
              >
                <option value="not_required">Not Required</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="reimbursed">Reimbursed</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search purpose/category"
                value={filters.searchTerm || ''}
                onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, searchTerm: e.target.value })); }}
                className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <select
                value={filters.isBackfilled === 'all' ? 'all' : filters.isBackfilled ? 'yes' : 'no'}
                onChange={(e) => {
                  const v = e.target.value;
                  setPage(1);
                  setFilters((f) => ({ ...f, isBackfilled: v === 'all' ? 'all' : v === 'yes' }));
                }}
                className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All</option>
                <option value="yes">Backfilled</option>
                <option value="no">Live</option>
              </select>
            </div>
            <div>
              <select
                value={filters.paidBy || 'all'}
                onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, paidBy: e.target.value as any })); }}
                className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Paid by (all)</option>
                <option value="company">Company</option>
                <option value="employee">Employee</option>
              </select>
            </div>
            <div>
              <select
                value={filters.approvalStatus || 'all'}
                onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, approvalStatus: e.target.value as any })); }}
                className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Approval (all)</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="locked">Locked</option>
              </select>
            </div>
            <div>
              <select
                value={filters.reimbursementStatus || 'all'}
                onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, reimbursementStatus: e.target.value as any })); }}
                className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Reimbursement (all)</option>
                <option value="not_required">Not required</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="reimbursed">Reimbursed</option>
              </select>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Vendor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">VAT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Paid By</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Period</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-800">
                        <div className="font-medium">{exp.expense_date}</div>
                        <div className="text-xs text-slate-500">Submitted {exp.submission_date || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{vendorName(exp.vendor_id)}</div>
                        <div className="text-xs text-slate-500">{accountName(exp.account_id)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-800">{exp.category || '—'}</div>
                        <div className="text-xs text-slate-500">{exp.subcategory || exp.business_purpose || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-800">
                        <div className="font-semibold">{formatCurrency(Number(exp.gross_amount || 0), exp.currency || 'AED')}</div>
                        <div className="text-xs text-slate-500">Net {formatCurrency(Number(exp.net_amount || 0), exp.currency || 'AED')}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-800">
                        <div>{formatCurrency(Number(exp.vat_amount || 0), exp.currency || 'AED')}</div>
                        <div className="text-xs text-slate-500">{exp.vat_rate ?? 0}% {exp.vat_recoverable ? '(recoverable)' : '(blocked)'}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-800">
                        <span className="px-2 py-1 rounded-full bg-slate-100 text-xs text-slate-700 capitalize">{exp.paid_by}</span>
                        {exp.employee_user_id && (
                          <div className="text-xs text-slate-500 mt-1">Employee linked</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="px-2 py-1 rounded-full text-xs bg-blue-50 text-blue-700 capitalize">{exp.approval_status}</span>
                          <span className="px-2 py-1 rounded-full text-xs bg-emerald-50 text-emerald-700 capitalize">{exp.reimbursement_status}</span>
                          {exp.is_backfilled && (
                            <span className="px-2 py-1 rounded-full text-xs bg-amber-50 text-amber-800 flex items-center gap-1">
                              <CalendarClock className="w-3 h-3" /> Backfill
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-800">
                        <div>{exp.period_year}-{String(exp.period_month).padStart(2, '0')}</div>
                        {exp.approval_status === 'locked' && (
                          <div className="flex items-center gap-1 text-xs text-slate-500"><BadgeCheck className="w-3 h-3" /> Locked</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
                            onClick={() => handleEdit(exp)}
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4 text-slate-600" />
                          </button>
                          <button
                            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
                            onClick={() => {
                              if (confirm('Delete this expense?')) {
                                supabaseHelpers.deleteExpense(exp.id).then(loadExpenses).catch((e) => setError(e?.message || 'Failed to delete expense'));
                              }
                            }}
                            title="Delete"
                          >
                            <X className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {expenses.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-center text-slate-600">
                        No expenses yet. Record the first one above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-slate-600">Page {page} of {totalPages}</div>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Prev
              </button>
              <button
                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 text-sm text-slate-600 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          Backfilled expenses are flagged and should be locked via accounting periods once reconciled.
        </div>
      </div>
    </div>
  );
}
