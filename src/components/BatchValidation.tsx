import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabaseHelpers, KitchenBatch, KitchenProcess, KitchenProcessType } from '../lib/supabaseHelpers';
import { supabase } from '../lib/supabase';

type BatchValidationProps = {
  batch: KitchenBatch;
  onBack: () => void;
  onValidated: (batch: KitchenBatch) => void;
};

export default function BatchValidation({ batch, onBack, onValidated }: BatchValidationProps) {
  const [processes, setProcesses] = useState<KitchenProcess[]>([]);
  const [types, setTypes] = useState<KitchenProcessType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusPreview, setStatusPreview] = useState<'good' | 'moderate' | 'shift_detected' | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [chefDisplayName, setChefDisplayName] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [procs, pts] = await Promise.all([
          supabaseHelpers.getKitchenProcessesForBatch(batch.id),
          supabaseHelpers.getKitchenProcessTypes(),
        ]);
        if (!mounted) return;
        setProcesses(procs as any);
        setTypes(pts);
        setStatusPreview(calculatePreview(procs || [], pts));
      } catch (e: any) {
        setError(e?.message || 'Failed to load batch data');
      }
    })();
    return () => { mounted = false; };
  }, [batch.id]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      if (user) {
        const name = (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || user.email || null;
        setCurrentUserName(name);
        setCurrentUserId(user.id);
      } else {
        setCurrentUserName(null);
        setCurrentUserId(null);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cu = await supabaseHelpers.getCompanyUserById(batch.chef_id);
        if (!mounted) return;
        setChefDisplayName(cu?.display_name || null);
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [batch.chef_id]);

  function calculatePreview(procs: KitchenProcess[], pts: KitchenProcessType[]) {
    const map = new Map(pts.map((t) => [t.id, t]));
    let status: 'good' | 'moderate' | 'shift_detected' = 'good';
    let hardViolations = 0;
    for (const p of procs) {
      const tp = map.get(p.process_type_id);
      if (!tp) continue;
      const d = Number(p.duration_minutes || 0);
      const min = Number(tp.standard_duration_minutes) - Number(tp.variation_buffer_minutes);
      const max = Number(tp.standard_duration_minutes) + Number(tp.variation_buffer_minutes);
      if (d < min || d > max) {
        status = status === 'shift_detected' ? status : 'moderate';
      }
      if (d > max * 2 || d < Math.max(min / 2, 0)) {
        status = 'shift_detected';
        hardViolations += 1;
      }
    }
    return status;
  }

  async function handleValidate() {
    setLoading(true);
    setError(null);
    try {
      const updated = await supabaseHelpers.validateKitchenBatch(batch.id);
      onValidated(updated);
    } catch (e: any) {
      setError(e?.message || 'Validation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-3xl mx-auto p-3 sm:p-5">
        <div className="mb-6 flex items-center gap-2">
          <button onClick={onBack} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200 hover:border-slate-300" title="Back">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <h1 className="text-lg md:text-2xl font-bold text-slate-800">Batch Validation</h1>
        </div>
        {error && <div className="mb-4 text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="mb-4">
            <div className="text-sm text-slate-600">Batch</div>
            <div className="text-slate-800 font-semibold">{batch.halwa_type} • {Number(batch.starch_weight)} kg</div>
            <div className="text-slate-600 text-sm">Total: {batch.total_duration ? Number(batch.total_duration).toFixed(2) : '-'} min</div>
            <div className="text-slate-600 text-sm">Cooked by: {batch.chef_name || chefDisplayName || (batch.chef_id === currentUserId ? (currentUserName || batch.chef_id) : (batch.chef_id || batch.created_by))}</div>
          </div>
          <div className="mb-4">
            <div className="text-sm font-semibold text-slate-700 mb-2">Processes</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Start</th>
                  <th className="px-3 py-2 text-left">End</th>
                  <th className="px-3 py-2 text-left">Std (min)</th>
                  <th className="px-3 py-2 text-left">Buffer (±)</th>
                  <th className="px-3 py-2 text-left">Range</th>
                  <th className="px-3 py-2 text-left">Recorded (min)</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {processes.map((p) => {
                  const t = types.find((x) => x.id === p.process_type_id);
                  const d = Number(p.duration_minutes || 0);
                  const min = t ? Number(t.standard_duration_minutes) - Number(t.variation_buffer_minutes) : 0;
                  const max = t ? Number(t.standard_duration_minutes) + Number(t.variation_buffer_minutes) : 0;
                  const ok = t ? d >= min && d <= max : false;
                  const violationLabel = !t ? '-' : ok ? 'OK' : d < min ? `Below by ${(min - d).toFixed(2)} min` : `Above by ${(d - max).toFixed(2)} min`;
                  const rowClass = ok ? '' : 'bg-amber-50';
                  return (
                    <tr key={p.id} className={rowClass}>
                      <td className="px-3 py-2">{t?.name || p.process_type_id}</td>
                      <td className="px-3 py-2 text-slate-600">{p.start_time ? new Date(p.start_time).toLocaleTimeString() : '-'}</td>
                      <td className="px-3 py-2 text-slate-600">{p.end_time ? new Date(p.end_time).toLocaleTimeString() : '-'}</td>
                      <td className="px-3 py-2">{t ? Number(t.standard_duration_minutes) : '-'}</td>
                      <td className="px-3 py-2">{t ? Number(t.variation_buffer_minutes) : '-'}</td>
                      <td className="px-3 py-2">{t ? `${(min).toFixed(2)}–${(max).toFixed(2)}` : '-'}</td>
                      <td className="px-3 py-2">{d.toFixed(2)}</td>
                      <td className={`px-3 py-2 ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>{violationLabel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">Preview status: {statusPreview || '-'} • Violations: {processes.reduce((acc, p) => {
              const t = types.find((x) => x.id === p.process_type_id);
              if (!t) return acc;
              const d = Number(p.duration_minutes || 0);
              const min = Number(t.standard_duration_minutes) - Number(t.variation_buffer_minutes);
              const max = Number(t.standard_duration_minutes) + Number(t.variation_buffer_minutes);
              return acc + ((d < min || d > max) ? 1 : 0);
            }, 0)}</div>
            <button onClick={handleValidate} disabled={loading} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">Validate Batch</button>
          </div>
        </div>
      </div>
    </div>
  );
}