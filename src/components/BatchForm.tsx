import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabaseHelpers, KitchenBatch, HalwaType } from '../lib/supabaseHelpers';

type BatchFormProps = {
  onBack: () => void;
  onCreated: (batch: KitchenBatch) => void;
};

export default function BatchForm({ onBack, onCreated }: BatchFormProps) {
  const [halwaTypes, setHalwaTypes] = useState<HalwaType[]>([]);
  const [selectedHalwaIds, setSelectedHalwaIds] = useState<string[]>([]);
  const [starchWeight, setStarchWeight] = useState<number>(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const types = await supabaseHelpers.getHalwaTypes();
        if (!mounted) return;
        setHalwaTypes(types.filter(t => t.active));
      } catch (e: any) {
        setError(e?.message || 'Failed to load halwa types');
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const halwaLabel = halwaTypes
        .filter(ht => selectedHalwaIds.includes(ht.id))
        .map(ht => ht.name)
        .join(', ');
      const batch = await supabaseHelpers.createKitchenBatch({ halwa_type: halwaLabel || 'Halwa', starch_weight: starchWeight });
      // Precreate processes based on selected halwa types
      if (selectedHalwaIds.length > 0) {
        await supabaseHelpers.precreateKitchenProcessesForBatch(batch.id, selectedHalwaIds);
      }
      onCreated(batch);
    } catch (e: any) {
      setError(e?.message || 'Failed to create batch');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-xl mx-auto p-3 sm:p-5">
        <div className="mb-6 flex items-center gap-2">
          <button onClick={onBack} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200 hover:border-slate-300" title="Back">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <h1 className="text-lg md:text-2xl font-bold text-slate-800">Start New Batch</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Halwa Types</label>
            {halwaTypes.length === 0 ? (
              <div className="text-slate-600 text-sm">No halwa types defined yet. Admins can add them in Kitchen Admin.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {halwaTypes.map((ht) => (
                  <label key={ht.id} className="flex items-center gap-2 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedHalwaIds.includes(ht.id)}
                      onChange={(e) => {
                        setSelectedHalwaIds((prev) => e.target.checked ? [...prev, ht.id] : prev.filter(id => id !== ht.id));
                      }}
                    />
                    <span className="font-medium text-slate-800">{ht.name}</span>
                    <span className="ml-auto text-xs text-slate-600">Base {Number(ht.base_process_count)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">Starch Weight (kg)</label>
            <input
              type="number"
              step="0.01"
              value={starchWeight}
              onChange={(e) => setStarchWeight(parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 2"
              required
            />
          </div>
          {error && <div className="mb-4 text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onBack} className="px-4 py-2 bg-white border border-slate-300 rounded-lg">Cancel</button>
            <button type="submit" disabled={loading || selectedHalwaIds.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Starting...' : 'Start Batch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}