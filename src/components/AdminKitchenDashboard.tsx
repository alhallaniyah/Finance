import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Trash2, Edit2, Check, X, ArrowUp, ArrowDown } from 'lucide-react';
import { supabaseHelpers, HalwaType, HalwaProcessMap, KitchenProcessType } from '../lib/supabaseHelpers';

type AdminKitchenDashboardProps = {
  onBack: () => void;
};

export default function AdminKitchenDashboard({ onBack }: AdminKitchenDashboardProps) {
  const [activeTab, setActiveTab] = useState<'halwa' | 'templates' | 'validation'>('halwa');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto p-3 sm:p-5">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200 hover:border-slate-300" title="Back">
              <ArrowLeft className="w-5 h-5 text-slate-700" />
            </button>
            <h1 className="text-lg md:text-2xl font-bold text-slate-800">Admin • Kitchen</h1>
          </div>
        </header>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="border-b border-slate-200 flex">
            <button className={`px-4 py-2 text-sm ${activeTab === 'halwa' ? 'text-blue-700 border-b-2 border-blue-600' : 'text-slate-600'}`} onClick={() => setActiveTab('halwa')}>Halwa Types</button>
            <button className={`px-4 py-2 text-sm ${activeTab === 'templates' ? 'text-blue-700 border-b-2 border-blue-600' : 'text-slate-600'}`} onClick={() => setActiveTab('templates')}>Process Templates</button>
            <button className={`px-4 py-2 text-sm ${activeTab === 'validation' ? 'text-blue-700 border-b-2 border-blue-600' : 'text-slate-600'}`} onClick={() => setActiveTab('validation')}>Validation Summary</button>
          </div>
          <div className="p-4 sm:p-6">
            {activeTab === 'halwa' && <HalwaTypesTab />}
            {activeTab === 'templates' && <ProcessTemplatesTab />}
            {activeTab === 'validation' && <ValidationSummaryTab onOpenKitchen={() => onBack()} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function HalwaTypesTab() {
  const [types, setTypes] = useState<HalwaType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newBaseCount, setNewBaseCount] = useState<number>(10);
  const [newActive, setNewActive] = useState(true);
  const [editing, setEditing] = useState<Record<string, { name: string; base: number; active: boolean }>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await supabaseHelpers.getHalwaTypes();
      setTypes(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load halwa types');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await supabaseHelpers.createHalwaType({ name: newName.trim(), base_process_count: newBaseCount, active: newActive });
      setNewName('');
      setNewBaseCount(10);
      setNewActive(true);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to create halwa type');
    } finally { setLoading(false); }
  }

  async function handleSave(id: string) {
    const state = editing[id];
    if (!state) return;
    setLoading(true);
    setError(null);
    try {
      await supabaseHelpers.updateHalwaType(id, { name: state.name, base_process_count: state.base, active: state.active });
      const next = { ...editing }; delete next[id]; setEditing(next);
      await load();
    } catch (e: any) { setError(e?.message || 'Failed to update'); }
    finally { setLoading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this halwa type?')) return;
    setLoading(true);
    setError(null);
    try { await supabaseHelpers.deleteHalwaType(id); await load(); }
    catch (e: any) { setError(e?.message || 'Failed to delete'); }
    finally { setLoading(false); }
  }

  return (
    <div>
      {error && <div className="mb-4 text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
      <div className="mb-6">
        <div className="text-sm font-semibold text-slate-700 mb-2">Create Halwa Type</div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg" placeholder="Name" />
          <input type="number" value={newBaseCount} onChange={(e) => setNewBaseCount(parseInt(e.target.value))} className="w-28 px-3 py-2 border border-slate-300 rounded-lg" placeholder="Base count" />
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={newActive} onChange={(e) => setNewActive(e.target.checked)} /> Active</label>
          <button onClick={handleCreate} disabled={loading} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"><Plus className="w-4 h-4" /> Create</button>
        </div>
      </div>

      <div className="text-sm font-semibold text-slate-700 mb-2">Halwa Types</div>
      <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg">
        <table className="min-w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Name</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Base Count</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Active</th>
              <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {types.map((t) => {
              const edit = editing[t.id];
              return (
                <tr key={t.id}>
                  <td className="px-4 py-2">
                    {edit ? (
                      <input value={edit.name} onChange={(e) => setEditing({ ...editing, [t.id]: { ...edit, name: e.target.value } })} className="px-2 py-1 border border-slate-300 rounded" />
                    ) : (
                      <span>{t.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {edit ? (
                      <input type="number" value={edit.base} onChange={(e) => setEditing({ ...editing, [t.id]: { ...edit, base: parseInt(e.target.value) } })} className="w-24 px-2 py-1 border border-slate-300 rounded" />
                    ) : (
                      <span>{Number(t.base_process_count)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {edit ? (
                      <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={edit.active} onChange={(e) => setEditing({ ...editing, [t.id]: { ...edit, active: e.target.checked } })} /> Active</label>
                    ) : (
                      <span className={t.active ? 'text-emerald-700' : 'text-slate-500'}>{t.active ? 'Yes' : 'No'}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {!edit && (
                      <button onClick={() => setEditing({ ...editing, [t.id]: { name: t.name, base: Number(t.base_process_count), active: t.active } })} className="px-2 py-1 bg-slate-600 text-white rounded mr-2"><Edit2 className="w-4 h-4" /></button>
                    )}
                    {edit && (
                      <>
                        <button onClick={() => handleSave(t.id)} className="px-2 py-1 bg-emerald-600 text-white rounded mr-2"><Check className="w-4 h-4" /></button>
                        <button onClick={() => { const next = { ...editing }; delete next[t.id]; setEditing(next); }} className="px-2 py-1 bg-slate-500 text-white rounded"><X className="w-4 h-4" /></button>
                      </>
                    )}
                    {!edit && (
                      <button onClick={() => handleDelete(t.id)} className="px-2 py-1 bg-red-600 text-white rounded ml-2"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProcessTemplatesTab() {
  const [halwaTypes, setHalwaTypes] = useState<HalwaType[]>([]);
  const [selectedHalwaId, setSelectedHalwaId] = useState<string | null>(null);
  const [processTypes, setProcessTypes] = useState<KitchenProcessType[]>([]);
  const [mappings, setMappings] = useState<HalwaProcessMap[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const processTypeById = useMemo(() => Object.fromEntries(processTypes.map(pt => [pt.id, pt])), [processTypes]);
  const [quickCount, setQuickCount] = useState<number>(0);
  const [quickNames, setQuickNames] = useState<string[]>([]);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingFields, setEditingFields] = useState<{ name: string; std: number; buf: number } | null>(null);
  const [editingAll, setEditingAll] = useState(false);
  const [bulkEditing, setBulkEditing] = useState<Record<string, { name: string; std: number; buf: number }>>({});
  const [role, setRole] = useState<'admin' | 'manager' | 'sales' | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => { (async () => {
    try {
      const [types, pts] = await Promise.all([
        supabaseHelpers.getHalwaTypes(),
        supabaseHelpers.getKitchenProcessTypes(),
      ]);
      setHalwaTypes(types);
      setProcessTypes(pts);
      const r = await supabaseHelpers.getCurrentUserRole();
      setRole(r);
      if (!selectedHalwaId && types.length > 0) setSelectedHalwaId(types[0].id);
      // prime quick count from selected halwa base count
      const selected = types[0];
      if (selected && typeof selected.base_process_count === 'number') {
        const bc = Number(selected.base_process_count) || 0;
        setQuickCount(bc);
        setQuickNames(Array.from({ length: bc }, () => ''));
      }
    } catch (e: any) { setError(e?.message || 'Failed to load'); }
  })(); }, []);

  useEffect(() => { (async () => {
    if (!selectedHalwaId) return;
    setLoading(true); setError(null);
    try { const data = await supabaseHelpers.getHalwaProcessMap(selectedHalwaId); setMappings(data); }
    catch (e: any) { setError(e?.message || 'Failed to load process map'); }
    finally { setLoading(false); }
  })(); }, [selectedHalwaId]);

  useEffect(() => {
    // resize names array when count changes, preserving existing entries
    setQuickNames((prev) => {
      const next = Array.from({ length: Math.max(0, quickCount) }, (_, i) => prev[i] ?? '');
      return next;
    });
  }, [quickCount]);

  const availableToAdd = useMemo(() => processTypes.filter(pt => !mappings.some(m => m.process_type_id === pt.id)), [processTypes, mappings]);

  const totalAverageMinutes = useMemo(() => {
    return mappings.reduce((sum, m) => {
      const t = processTypeById[m.process_type_id];
      return sum + (t ? Number(t.standard_duration_minutes) : 0);
    }, 0);
  }, [mappings, processTypeById]);

  useEffect(() => {
    if (!editingAll) return;
    // initialize bulk editing state based on current template mapping
    const initial: Record<string, { name: string; std: number; buf: number }> = {};
    mappings.forEach(m => {
      const t = processTypeById[m.process_type_id];
      if (t) initial[m.process_type_id] = {
        name: t.name || '',
        std: Number(t.standard_duration_minutes || 0),
        buf: Number(t.variation_buffer_minutes || 0),
      };
    });
    setBulkEditing(initial);
  }, [editingAll, mappings, processTypeById]);

  async function addMapping(processTypeId: string) {
    if (!selectedHalwaId) return;
    setLoading(true); setError(null);
    try {
      const seq = (mappings[mappings.length - 1]?.sequence_order || 0) + 1;
      await supabaseHelpers.upsertHalwaProcessMap({ halwa_type_id: selectedHalwaId, process_type_id: processTypeId, sequence_order: seq });
      const data = await supabaseHelpers.getHalwaProcessMap(selectedHalwaId); setMappings(data);
    } catch (e: any) { setError(e?.message || 'Failed to add'); }
    finally { setLoading(false); }
  }

  async function removeMapping(id: string) {
    if (!selectedHalwaId) return;
    setLoading(true); setError(null);
    try { await supabaseHelpers.deleteHalwaProcessMap(id); const data = await supabaseHelpers.getHalwaProcessMap(selectedHalwaId); setMappings(data); }
    catch (e: any) { setError(e?.message || 'Failed to remove'); }
    finally { setLoading(false); }
  }

  async function move(id: string, dir: 'up' | 'down') {
    const idx = mappings.findIndex(m => m.id === id);
    if (idx < 0) return;
    const swapWith = dir === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= mappings.length) return;
    const next = mappings.slice();
    const [m] = next.splice(idx, 1);
    next.splice(swapWith, 0, m);
    // Re-number sequence order locally and persist
    const orderedIds = next.map(m => m.id);
    setMappings(next.map((m, i) => ({ ...m, sequence_order: i + 1 })));
    try { await supabaseHelpers.reorderHalwaProcessMap(selectedHalwaId!, orderedIds); }
    catch (e: any) { setError(e?.message || 'Failed to reorder'); }
  }

  async function quickCreateAndAdd() {
    if (!selectedHalwaId) return;
    setLoading(true); setError(null);
    try {
      let seq = (mappings[mappings.length - 1]?.sequence_order || 0);
      for (const raw of quickNames) {
        const name = raw.trim();
        if (!name) continue;
        const pt = await supabaseHelpers.findOrCreateKitchenProcessType({ name });
        seq += 1;
        await supabaseHelpers.upsertHalwaProcessMap({ halwa_type_id: selectedHalwaId, process_type_id: pt.id, sequence_order: seq });
      }
      const data = await supabaseHelpers.getHalwaProcessMap(selectedHalwaId);
      setMappings(data);
      // reset quick inputs
      setQuickCount(0);
      setQuickNames([]);
    } catch (e: any) {
      setError(e?.message || 'Failed to create/add processes');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {error && <div className="mb-4 text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
      {info && <div className="mb-4 text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3">{info}</div>}
      {role === 'sales' && (
        <div className="mb-3 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
          Sales role can view templates but cannot save changes. Please ask a manager or admin to update process timings.
        </div>
      )}
      <div className="flex items-center gap-2 mb-4">
        <label className="text-sm text-slate-700">Halwa Type:</label>
        <select value={selectedHalwaId || ''} onChange={(e) => setSelectedHalwaId(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg">
          {halwaTypes.map(ht => (
            <option key={ht.id} value={ht.id}>{ht.name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-2">Template Sequence</div>
          <div className="mb-2 text-sm text-slate-600">Total average (sum of Std): <span className="font-semibold text-slate-800">{totalAverageMinutes.toFixed(2)} min</span></div>
          <div className="mb-3 flex items-center gap-2">
            {!editingAll ? (
              <button onClick={() => { setEditingAll(true); setInfo(null); }} disabled={role === 'sales'} className="px-3 py-2 bg-slate-700 text-white rounded-lg disabled:opacity-50">Edit All</button>
            ) : (
              <>
                <button
                  onClick={async () => {
                    setLoading(true); setError(null);
                    try {
                      const entries = Object.entries(bulkEditing);
                      const toSave = entries.filter(([pid, fields]) => {
                        const current = processTypeById[pid];
                        return !current || current.name !== fields.name || Number(current.standard_duration_minutes) !== Number(fields.std) || Number(current.variation_buffer_minutes) !== Number(fields.buf);
                      });
                      await Promise.all(toSave.map(([pid, fields]) => supabaseHelpers.updateKitchenProcessType(pid, {
                        name: fields.name,
                        standard_duration_minutes: fields.std,
                        variation_buffer_minutes: fields.buf,
                      })));
                      const pts = await supabaseHelpers.getKitchenProcessTypes();
                      setProcessTypes(pts);
                      setEditingAll(false);
                      setBulkEditing({});
                      setInfo(toSave.length > 0 ? `Saved ${toSave.length} change${toSave.length > 1 ? 's' : ''}.` : 'No changes to save.');
                    } catch (e: any) {
                      setError(e?.message || 'Failed to save all changes');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={role === 'sales' || loading}
                  className="px-3 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50"
                >
                  Save All
                </button>
                <button onClick={() => { setEditingAll(false); setBulkEditing({}); setInfo(null); }} className="px-3 py-2 bg-slate-500 text-white rounded-lg">Cancel</button>
              </>
            )}
          </div>
          <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg">
            <table className="min-w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Order</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Process</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Std (min)</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Buffer (±)</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {mappings.map((m, idx) => (
                  <tr key={m.id}>
                    <td className="px-4 py-2">{idx + 1}</td>
                    <td className="px-4 py-2">
                      {editingAll || editingTypeId === m.process_type_id ? (
                        <input
                          value={editingAll ? (bulkEditing[m.process_type_id]?.name ?? processTypeById[m.process_type_id]?.name ?? '') : (editingFields?.name ?? processTypeById[m.process_type_id]?.name ?? '')}
                          onChange={(e) => {
                            if (editingAll) {
                              setBulkEditing(prev => ({
                                ...prev,
                                [m.process_type_id]: {
                                  name: e.target.value,
                                  std: prev[m.process_type_id]?.std ?? Number(processTypeById[m.process_type_id]?.standard_duration_minutes || 0),
                                  buf: prev[m.process_type_id]?.buf ?? Number(processTypeById[m.process_type_id]?.variation_buffer_minutes || 0),
                                },
                              }));
                            } else {
                              setEditingFields((prev) => ({
                                name: e.target.value,
                                std: prev?.std ?? Number(processTypeById[m.process_type_id]?.standard_duration_minutes || 0),
                                buf: prev?.buf ?? Number(processTypeById[m.process_type_id]?.variation_buffer_minutes || 0),
                              }));
                            }
                          }}
                          className="px-2 py-1 border border-slate-300 rounded w-40"
                        />
                      ) : (
                        <span>{processTypeById[m.process_type_id]?.name || m.process_type_id}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {editingAll || editingTypeId === m.process_type_id ? (
                        <input
                          type="number"
                          value={editingAll ? (bulkEditing[m.process_type_id]?.std ?? Number(processTypeById[m.process_type_id]?.standard_duration_minutes || 0)) : (editingFields?.std ?? Number(processTypeById[m.process_type_id]?.standard_duration_minutes || 0))}
                          onChange={(e) => {
                            const val = Number(e.target.value || 0);
                            if (editingAll) {
                              setBulkEditing(prev => ({
                                ...prev,
                                [m.process_type_id]: {
                                  name: prev[m.process_type_id]?.name ?? (processTypeById[m.process_type_id]?.name || ''),
                                  std: val,
                                  buf: prev[m.process_type_id]?.buf ?? Number(processTypeById[m.process_type_id]?.variation_buffer_minutes || 0),
                                },
                              }));
                            } else {
                              setEditingFields((prev) => ({
                                name: prev?.name ?? (processTypeById[m.process_type_id]?.name || ''),
                                std: val,
                                buf: prev?.buf ?? Number(processTypeById[m.process_type_id]?.variation_buffer_minutes || 0),
                              }));
                            }
                          }}
                          className="w-24 px-2 py-1 border border-slate-300 rounded"
                        />
                      ) : (
                        <span>{Number(processTypeById[m.process_type_id]?.standard_duration_minutes || 0)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {editingAll || editingTypeId === m.process_type_id ? (
                        <input
                          type="number"
                          value={editingAll ? (bulkEditing[m.process_type_id]?.buf ?? Number(processTypeById[m.process_type_id]?.variation_buffer_minutes || 0)) : (editingFields?.buf ?? Number(processTypeById[m.process_type_id]?.variation_buffer_minutes || 0))}
                          onChange={(e) => {
                            const val = Number(e.target.value || 0);
                            if (editingAll) {
                              setBulkEditing(prev => ({
                                ...prev,
                                [m.process_type_id]: {
                                  name: prev[m.process_type_id]?.name ?? (processTypeById[m.process_type_id]?.name || ''),
                                  std: prev[m.process_type_id]?.std ?? Number(processTypeById[m.process_type_id]?.standard_duration_minutes || 0),
                                  buf: val,
                                },
                              }));
                            } else {
                              setEditingFields((prev) => ({
                                name: prev?.name ?? (processTypeById[m.process_type_id]?.name || ''),
                                std: prev?.std ?? Number(processTypeById[m.process_type_id]?.standard_duration_minutes || 0),
                                buf: val,
                              }));
                            }
                          }}
                          className="w-24 px-2 py-1 border border-slate-300 rounded"
                        />
                      ) : (
                        <span>{Number(processTypeById[m.process_type_id]?.variation_buffer_minutes || 0)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {editingAll ? (
                        <span className="text-slate-500 text-sm">Editing</span>
                      ) : editingTypeId === m.process_type_id ? (
                        <>
                          <button
                            onClick={async () => {
                              const fields = editingFields || {
                                name: processTypeById[m.process_type_id]?.name || '',
                                std: Number(processTypeById[m.process_type_id]?.standard_duration_minutes || 0),
                                buf: Number(processTypeById[m.process_type_id]?.variation_buffer_minutes || 0),
                              };
                              setLoading(true); setError(null);
                              try {
                                await supabaseHelpers.updateKitchenProcessType(m.process_type_id, {
                                  name: fields.name,
                                  standard_duration_minutes: fields.std,
                                  variation_buffer_minutes: fields.buf,
                                });
                                const pts = await supabaseHelpers.getKitchenProcessTypes();
                                setProcessTypes(pts);
                                setEditingTypeId(null);
                                setEditingFields(null);
                              } catch (e: any) {
                                setError(e?.message || 'Failed to update process type');
                              } finally {
                                setLoading(false);
                              }
                            }}
                            className="px-2 py-1 bg-emerald-600 text-white rounded mr-2"
                          >
                            <span className="inline-flex items-center gap-1"><Check className="w-4 h-4" /> Save</span>
                          </button>
                          <button onClick={() => { setEditingTypeId(null); setEditingFields(null); }} className="px-2 py-1 bg-slate-500 text-white rounded mr-2"><span className="inline-flex items-center gap-1"><X className="w-4 h-4" /> Cancel</span></button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            const t = processTypeById[m.process_type_id];
                            setEditingTypeId(m.process_type_id);
                            setEditingFields({ name: t?.name || '', std: Number(t?.standard_duration_minutes || 0), buf: Number(t?.variation_buffer_minutes || 0) });
                          }}
                          className="px-2 py-1 bg-slate-600 text-white rounded mr-2"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => move(m.id, 'up')} className="px-2 py-1 bg-slate-600 text-white rounded mr-2"><ArrowUp className="w-4 h-4" /></button>
                      <button onClick={() => move(m.id, 'down')} className="px-2 py-1 bg-slate-600 text-white rounded mr-2"><ArrowDown className="w-4 h-4" /></button>
                      <button onClick={() => removeMapping(m.id)} className="px-2 py-1 bg-red-600 text-white rounded"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-2">Add Process</div>
          <div className="flex items-center gap-2">
            <select className="flex-1 px-3 py-2 border border-slate-300 rounded-lg" defaultValue="">
              <option value="" disabled>Select a process type</option>
              {availableToAdd.map(pt => (
                <option key={pt.id} value={pt.id}>{pt.name}</option>
              ))}
            </select>
            <button onClick={(e) => {
              const select = (e.currentTarget.previousElementSibling as HTMLSelectElement);
              const val = select.value; if (!val) return; addMapping(val); select.value = '';
            }} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Plus className="w-4 h-4" /> Add</button>
          </div>

          <div className="mt-6">
            <div className="text-sm font-semibold text-slate-700 mb-2">Quick Create by Count</div>
            <div className="flex items-center gap-2 mb-3">
              <label className="text-sm text-slate-700">Number of processes:</label>
              <input type="number" value={quickCount} onChange={(e) => setQuickCount(Math.max(0, parseInt(e.target.value || '0')))} className="w-28 px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            {quickCount > 0 && (
              <div className="grid grid-cols-1 gap-2">
                {quickNames.map((val, i) => (
                  <input key={i} value={val} onChange={(e) => setQuickNames((prev) => prev.map((x, idx) => idx === i ? e.target.value : x))} className="px-3 py-2 border border-slate-300 rounded-lg" placeholder={`Process #${i + 1} name`} />
                ))}
              </div>
            )}
            <div className="mt-3">
              <button onClick={quickCreateAndAdd} disabled={loading || !selectedHalwaId || quickNames.every(n => !n.trim())} className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                Create and Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ValidationSummaryTab({ onOpenKitchen }: { onOpenKitchen: () => void }) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-slate-700">Validation is performed per batch. Open the Kitchen dashboard to pick a batch and run validation.</div>
      <button onClick={onOpenKitchen} className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Go to Kitchen Dashboard</button>
    </div>
  );
}