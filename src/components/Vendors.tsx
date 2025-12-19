import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Edit3, Loader2, Plus, RefreshCcw, X } from 'lucide-react';
import { supabaseHelpers, Vendor, VendorType } from '../lib/supabaseHelpers';

type VendorsProps = {
  onBack: () => void;
};

const vendorTypes: Array<{ value: VendorType; label: string }> = [
  { value: 'supplier', label: 'Supplier' },
  { value: 'utility', label: 'Utility' },
  { value: 'landlord', label: 'Landlord' },
  { value: 'government', label: 'Government' },
  { value: 'other', label: 'Other' },
];

export default function Vendors({ onBack }: VendorsProps) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<VendorType>('supplier');
  const [vatTrn, setVatTrn] = useState('');
  const [country, setCountry] = useState('');
  const [defaultVatRate, setDefaultVatRate] = useState('');
  const [notes, setNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await supabaseHelpers.getVendors();
      setVendors(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setName('');
    setType('supplier');
    setVatTrn('');
    setCountry('');
    setDefaultVatRate('');
    setNotes('');
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        type,
        vat_trn: vatTrn.trim() || null,
        country: country.trim() || null,
        default_vat_rate: defaultVatRate ? Number(defaultVatRate) : null,
        notes: notes.trim() || null,
      };
      if (editingId) {
        await supabaseHelpers.updateVendor(editingId, payload);
      } else {
        await supabaseHelpers.createVendor(payload);
      }
      resetForm();
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to save vendor');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(vendor: Vendor) {
    setSaving(true);
    try {
      await supabaseHelpers.updateVendor(vendor.id, { is_active: !vendor.is_active });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to update vendor');
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return vendors;
    return vendors.filter((v) => (v.name || '').toLowerCase().includes(term) || (v.vat_trn || '').toLowerCase().includes(term));
  }, [vendors, searchTerm]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-2xl font-bold text-slate-800">Vendors</h1>
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
              <h2 className="text-lg font-semibold text-slate-800">{editingId ? 'Edit Vendor' : 'Add Vendor'}</h2>
              <p className="text-sm text-slate-600">Structured vendors only—no free text.</p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {editingId ? 'Save Changes' : 'Add Vendor'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Name</label>
              <input
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Vendor name"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Type</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={type}
                onChange={(e) => setType(e.target.value as VendorType)}
              >
                {vendorTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">VAT TRN</label>
              <input
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={vatTrn}
                onChange={(e) => setVatTrn(e.target.value)}
                placeholder="123456789000003"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Country</label>
              <input
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="UAE"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Default VAT Rate (%)</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={defaultVatRate}
                onChange={(e) => setDefaultVatRate(e.target.value)}
                placeholder="5"
                min="0"
                step="0.01"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-600 mb-1">Notes</label>
              <input
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Payment terms, contact, etc."
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Vendor Directory</h2>
              <p className="text-sm text-slate-600">Linked to expenses by ID only.</p>
            </div>
            <input
              type="text"
              placeholder="Search vendors..."
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">VAT TRN</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">VAT %</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{v.name}</div>
                        <div className="text-xs text-slate-500">{v.country || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 capitalize">{v.type || 'supplier'}</td>
                      <td className="px-4 py-3 text-slate-700">{v.vat_trn || '—'}</td>
                      <td className="px-4 py-3 text-slate-700">{typeof v.default_vat_rate === 'number' ? Number(v.default_vat_rate).toFixed(2) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${v.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {v.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
                            onClick={() => {
                              setEditingId(v.id);
                              setName(v.name || '');
                              setType((v.type as VendorType) || 'supplier');
                              setVatTrn(v.vat_trn || '');
                              setCountry(v.country || '');
                              setDefaultVatRate(v.default_vat_rate !== null && v.default_vat_rate !== undefined ? String(v.default_vat_rate) : '');
                              setNotes(v.notes || '');
                            }}
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4 text-slate-600" />
                          </button>
                          <button
                            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
                            onClick={() => toggleActive(v)}
                            title={v.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {v.is_active ? <X className="w-4 h-4 text-red-600" /> : <Check className="w-4 h-4 text-emerald-600" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-600">
                        No vendors yet. Add your first vendor above.
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
