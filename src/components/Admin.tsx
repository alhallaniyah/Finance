import { useEffect, useState } from 'react';
import { supabaseHelpers, Item, DeliveryProvider, ExpenseCategory, ExpenseCategoryVatTreatment } from '../lib/supabaseHelpers';
import { ArrowLeft, Plus, Edit3, Save, X, Trash2, Loader2 } from 'lucide-react';

type AdminProps = {
  onBack: () => void;
};

export default function Admin({ onBack }: AdminProps) {
  const [role, setRole] = useState<'admin' | 'manager' | 'sales' | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newSellBy, setNewSellBy] = useState<'unit' | 'weight'>('unit');
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editSellBy, setEditSellBy] = useState<'unit' | 'weight'>('unit');

  // Delivery providers state
  const [providers, setProviders] = useState<DeliveryProvider[]>([]);
  const [provNewName, setProvNewName] = useState('');
  const [provNewPhone, setProvNewPhone] = useState('');
  const [provNewMethod, setProvNewMethod] = useState('');
  const [provNewManaged, setProvNewManaged] = useState(false);

  const [provEditingId, setProvEditingId] = useState<string | null>(null);
  const [provEditName, setProvEditName] = useState('');
  const [provEditPhone, setProvEditPhone] = useState('');
  const [provEditMethod, setProvEditMethod] = useState('');
  const [provEditManaged, setProvEditManaged] = useState(false);

  // Expense categories state
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [catName, setCatName] = useState('');
  const [catCode, setCatCode] = useState('');
  const [catParentId, setCatParentId] = useState('');
  const [catLedgerCode, setCatLedgerCode] = useState('');
  const [catDefaultVatTreatment, setCatDefaultVatTreatment] = useState<ExpenseCategoryVatTreatment>('recoverable');
  const [catRequiresReceipt, setCatRequiresReceipt] = useState(false);
  const [catRequiresApprovalAbove, setCatRequiresApprovalAbove] = useState('');
  const [catIsActive, setCatIsActive] = useState(true);
  const [catPolicyNotes, setCatPolicyNotes] = useState('');
  const [catEditingId, setCatEditingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await supabaseHelpers.getCurrentUserRole();
        setRole(r);
        await loadItems();
        await loadProviders();
        await loadCategories();
      } catch (e: any) {
        setError(e?.message || 'Failed to initialize');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function loadItems() {
    setLoading(true);
    try {
      const data = await supabaseHelpers.getItems();
      setItems(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load items');
    } finally {
      setLoading(false);
    }
  }

  async function loadProviders() {
    try {
      const data = await supabaseHelpers.getDeliveryProviders();
      setProviders(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load delivery providers');
    }
  }

  async function loadCategories() {
    try {
      const data = await supabaseHelpers.getExpenseCategories();
      setCategories(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load categories');
    }
  }

  async function handleAddItem() {
    if (!newName.trim()) {
      setError('Item name is required');
      return;
    }
    const priceNum = Number(newPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setError('Price must be a non-negative number');
      return;
    }
    setSaving(true);
    try {
      await supabaseHelpers.createItem({ name: newName.trim(), sku: newSku.trim() || null, price: priceNum, sell_by: newSellBy });
      setNewName('');
      setNewSku('');
      setNewPrice('');
      setNewSellBy('unit');
      await loadItems();
    } catch (e: any) {
      setError(e?.message || 'Failed to add item');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: Item) {
    setEditingId(item.id);
    setEditName(item.name || '');
    setEditSku(item.sku || '');
    setEditPrice(String(item.price ?? ''));
    setEditSellBy((item.sell_by as 'unit' | 'weight') || 'unit');
  }

  async function saveEdit() {
    if (!editingId) return;
    if (!editName.trim()) {
      setError('Item name is required');
      return;
    }
    const priceNum = Number(editPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setError('Price must be a non-negative number');
      return;
    }
    setSaving(true);
    try {
      await supabaseHelpers.updateItem(editingId, { name: editName.trim(), sku: editSku.trim() || null, price: priceNum, sell_by: editSellBy });
      setEditingId(null);
      await loadItems();
    } catch (e: any) {
      setError(e?.message || 'Failed to save item');
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: string) {
    const confirmed = confirm('Delete this item? This action cannot be undone.');
    if (!confirmed) return;
    setSaving(true);
    try {
      await supabaseHelpers.deleteItem(id);
      await loadItems();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete item');
    } finally {
      setSaving(false);
    }
  }

  // Provider CRUD
  async function handleAddProvider() {
    if (!provNewName.trim()) {
      setError('Provider name is required');
      return;
    }
    setSaving(true);
    try {
      await supabaseHelpers.createDeliveryProvider({
        name: provNewName.trim(),
        phone: provNewPhone.trim() || undefined,
        method: provNewMethod.trim() || undefined,
        managed: provNewManaged,
      });
      setProvNewName('');
      setProvNewPhone('');
      setProvNewMethod('');
      setProvNewManaged(false);
      await loadProviders();
    } catch (e: any) {
      setError(e?.message || 'Failed to add provider');
    } finally {
      setSaving(false);
    }
  }

  function startEditProvider(p: DeliveryProvider) {
    setProvEditingId(p.id);
    setProvEditName(p.name || '');
    setProvEditPhone(p.phone || '');
    setProvEditMethod(p.method || '');
    setProvEditManaged(Boolean(p.managed));
  }

  async function saveProviderEdit() {
    if (!provEditingId) return;
    if (!provEditName.trim()) {
      setError('Provider name is required');
      return;
    }
    setSaving(true);
    try {
      await supabaseHelpers.updateDeliveryProvider(provEditingId, {
        name: provEditName.trim(),
        phone: provEditPhone.trim() || null,
        method: provEditMethod.trim() || null,
        managed: provEditManaged,
      });
      setProvEditingId(null);
      await loadProviders();
    } catch (e: any) {
      setError(e?.message || 'Failed to save provider');
    } finally {
      setSaving(false);
    }
  }

  async function deleteProvider(id: string) {
    const confirmed = confirm('Delete this provider? This action cannot be undone.');
    if (!confirmed) return;
    setSaving(true);
    try {
      await supabaseHelpers.deleteDeliveryProvider(id);
      await loadProviders();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete provider');
    } finally {
      setSaving(false);
    }
  }

  async function saveCategory() {
    if (!catName.trim() || !catCode.trim()) {
      setError('Category name and code are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: catName.trim(),
        code: catCode.trim(),
        parent_category_id: catParentId || null,
        ledger_account_code: catLedgerCode.trim() || null,
        default_vat_treatment: catDefaultVatTreatment,
        requires_receipt: catRequiresReceipt,
        requires_approval_above: catRequiresApprovalAbove ? Number(catRequiresApprovalAbove) : null,
        is_active: catIsActive,
        policy_notes: catPolicyNotes.trim() || null,
      };
      if (catEditingId) {
        await supabaseHelpers.updateExpenseCategory(catEditingId, payload);
      } else {
        await supabaseHelpers.createExpenseCategory(payload);
      }
      resetCategoryForm();
      await loadCategories();
    } catch (e: any) {
      setError(e?.message || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  }

  function resetCategoryForm() {
    setCatEditingId(null);
    setCatName('');
    setCatCode('');
    setCatParentId('');
    setCatLedgerCode('');
    setCatDefaultVatTreatment('recoverable');
    setCatRequiresReceipt(false);
    setCatRequiresApprovalAbove('');
    setCatIsActive(true);
    setCatPolicyNotes('');
  }

  function startEditCategory(cat: ExpenseCategory) {
    setCatEditingId(cat.id);
    setCatName(cat.name || '');
    setCatCode(cat.code || '');
    setCatParentId(cat.parent_category_id || '');
    setCatLedgerCode(cat.ledger_account_code || '');
    setCatDefaultVatTreatment((cat.default_vat_treatment as ExpenseCategoryVatTreatment) || 'recoverable');
    setCatRequiresReceipt(Boolean(cat.requires_receipt));
    setCatRequiresApprovalAbove(cat.requires_approval_above != null ? String(cat.requires_approval_above) : '');
    setCatIsActive(cat.is_active);
    setCatPolicyNotes(cat.policy_notes || '');
  }

  async function toggleCategoryActive(cat: ExpenseCategory) {
    setSaving(true);
    try {
      await supabaseHelpers.updateExpenseCategory(cat.id, { is_active: !cat.is_active });
      await loadCategories();
    } catch (e: any) {
      setError(e?.message || 'Failed to update category');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-5xl mx-auto p-6">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={onBack} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <h1 className="text-2xl font-bold text-slate-800">Admin</h1>
          </div>
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (role === 'sales') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-5xl mx-auto p-6">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={onBack} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <h1 className="text-2xl font-bold text-slate-800">Admin</h1>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <p className="text-slate-700">You do not have access to admin functions.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-2xl font-bold text-slate-800">Admin</h1>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Items Catalog</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
            <input
              type="text"
              placeholder="Item name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="SKU (optional)"
              value={newSku}
              onChange={(e) => setNewSku(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="number"
              placeholder="Price"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">Sell by:</span>
              <button
                type="button"
                onClick={() => setNewSellBy('unit')}
                className={`px-2 py-1 rounded border text-xs ${newSellBy === 'unit' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-slate-700'}`}
              >
                Unit
              </button>
              <button
                type="button"
                onClick={() => setNewSellBy('weight')}
                className={`px-2 py-1 rounded border text-xs ${newSellBy === 'weight' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-slate-700'}`}
              >
                Weight
              </button>
            </div>
            <button
              onClick={handleAddItem}
              disabled={saving || !(role === 'admin' || role === 'manager')}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </div>
          {newSellBy === 'weight' && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-slate-600">Presets:</span>
              <span className="px-2 py-1 text-xs rounded bg-slate-100 text-slate-700">0.5kg</span>
              <span className="px-2 py-1 text-xs rounded bg-slate-100 text-slate-700">1kg</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Sell By</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      {editingId === it.id ? (
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 rounded"
                        />
                      ) : (
                        <span className="font-medium text-slate-800">{it.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === it.id ? (
                        <input
                          value={editSku}
                          onChange={(e) => setEditSku(e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 rounded"
                        />
                      ) : (
                        <span className="text-slate-700">{it.sku || '-'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === it.id ? (
                        <input
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-32 px-2 py-1 border border-slate-200 rounded"
                        />
                      ) : (
                        <span className="text-slate-800">{Number(it.price).toFixed(2)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === it.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditSellBy('unit')}
                            className={`px-2 py-1 rounded border text-xs ${editSellBy === 'unit' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-slate-700'}`}
                          >
                            Unit
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditSellBy('weight')}
                            className={`px-2 py-1 rounded border text-xs ${editSellBy === 'weight' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-slate-700'}`}
                          >
                            Weight
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-700">{(it.sell_by as 'unit' | 'weight') === 'weight' ? 'Weight' : 'Unit'}</span>
                      )}
                      {editingId === it.id && editSellBy === 'weight' && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-slate-600">Presets:</span>
                          <span className="px-2 py-1 text-xs rounded bg-slate-100 text-slate-700">0.5kg</span>
                          <span className="px-2 py-1 text-xs rounded bg-slate-100 text-slate-700">1kg</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {editingId === it.id ? (
                          <>
                            <button
                              onClick={saveEdit}
                              disabled={saving}
                              className="p-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            {(role === 'admin' || role === 'manager') && (
                              <button
                                onClick={() => startEdit(it)}
                                className="p-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            )}
                            {role === 'admin' && (
                              <button
                                onClick={() => deleteItem(it.id)}
                                disabled={saving}
                                className="p-2 bg-red-50 text-red-700 rounded hover:bg-red-100 disabled:opacity-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Delivery Providers Management */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">{catEditingId ? 'Edit Category' : 'Add Category'}</h2>
              <p className="text-sm text-slate-600">Expense categories with policy controls.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={saveCategory}
                disabled={saving}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {catEditingId ? 'Save Changes' : 'Add Category'}
              </button>
              {catEditingId && (
                <button
                  onClick={resetCategoryForm}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Name</label>
              <input
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Travel"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Code</label>
              <input
                value={catCode}
                onChange={(e) => setCatCode(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="TRVL"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Parent</label>
              <select
                value={catParentId}
                onChange={(e) => setCatParentId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">None</option>
                {categories.filter((c) => c.is_active || c.id === catParentId).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Ledger Account Code</label>
              <input
                value={catLedgerCode}
                onChange={(e) => setCatLedgerCode(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="5001"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Default VAT Treatment</label>
              <select
                value={catDefaultVatTreatment}
                onChange={(e) => setCatDefaultVatTreatment(e.target.value as ExpenseCategoryVatTreatment)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="recoverable">Recoverable</option>
                <option value="non_recoverable">Non-recoverable</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-700 inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={catRequiresReceipt}
                  onChange={(e) => setCatRequiresReceipt(e.target.checked)}
                />
                Requires receipt
              </label>
              <label className="text-sm text-slate-700 inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={catIsActive}
                  onChange={(e) => setCatIsActive(e.target.checked)}
                />
                Active
              </label>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Requires approval above</label>
              <input
                type="number"
                value={catRequiresApprovalAbove}
                onChange={(e) => setCatRequiresApprovalAbove(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Amount threshold"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-600 mb-1">Policy notes</label>
              <input
                value={catPolicyNotes}
                onChange={(e) => setCatPolicyNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Any limits or instructions"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">VAT</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Receipt</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{cat.name}</div>
                      {cat.parent_category_id && (
                        <div className="text-xs text-slate-600">Parent: {categories.find((c) => c.id === cat.parent_category_id)?.name || '-'}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{cat.code}</td>
                    <td className="px-4 py-3 capitalize text-slate-700">{cat.default_vat_treatment?.replace('_', ' ') || 'recoverable'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-medium ${cat.requires_receipt ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'}`}>
                        {cat.requires_receipt ? 'Required' : 'Optional'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-medium ${cat.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                        {cat.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => startEditCategory(cat)}
                          className="p-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleCategoryActive(cat)}
                          disabled={saving}
                          className={`p-2 rounded ${cat.is_active ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'} disabled:opacity-50`}
                        >
                          {cat.is_active ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Delivery Providers</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
            <input
              type="text"
              placeholder="Provider name"
              value={provNewName}
              onChange={(e) => setProvNewName(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Phone (optional)"
              value={provNewPhone}
              onChange={(e) => setProvNewPhone(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Method (optional)"
              value={provNewMethod}
              onChange={(e) => setProvNewMethod(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <label className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg">
              <input
                type="checkbox"
                checked={provNewManaged}
                onChange={(e) => setProvNewManaged(e.target.checked)}
              />
              <span className="text-sm text-slate-700">Managed</span>
            </label>
            <button
              onClick={handleAddProvider}
              disabled={saving || !(role === 'admin' || role === 'manager')}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Add Provider
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Method</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Managed</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {providers.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      {provEditingId === p.id ? (
                        <input
                          value={provEditName}
                          onChange={(e) => setProvEditName(e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 rounded"
                        />
                      ) : (
                        <span className="font-medium text-slate-800">{p.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {provEditingId === p.id ? (
                        <input
                          value={provEditPhone}
                          onChange={(e) => setProvEditPhone(e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 rounded"
                        />
                      ) : (
                        <span className="text-slate-700">{p.phone || '-'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {provEditingId === p.id ? (
                        <input
                          value={provEditMethod}
                          onChange={(e) => setProvEditMethod(e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 rounded"
                        />
                      ) : (
                        <span className="text-slate-700">{p.method || '-'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {provEditingId === p.id ? (
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={provEditManaged}
                            onChange={(e) => setProvEditManaged(e.target.checked)}
                          />
                          <span className="text-sm text-slate-700">Managed</span>
                        </label>
                      ) : (
                        <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-medium ${p.managed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>{p.managed ? 'Managed' : 'Unmanaged'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {provEditingId === p.id ? (
                          <>
                            <button
                              onClick={saveProviderEdit}
                              disabled={saving}
                              className="p-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setProvEditingId(null)}
                              className="p-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            {(role === 'admin' || role === 'manager') && (
                              <button
                                onClick={() => startEditProvider(p)}
                                className="p-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            )}
                            {role === 'admin' && (
                              <button
                                onClick={() => deleteProvider(p.id)}
                                disabled={saving}
                                className="p-2 bg-red-50 text-red-700 rounded hover:bg-red-100 disabled:opacity-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
