import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Play, StepForward, CheckCircle } from 'lucide-react';
import { supabaseHelpers, KitchenBatch, KitchenProcessType, KitchenProcess } from '../lib/supabaseHelpers';

type BatchProcessRunnerProps = {
  batch: KitchenBatch;
  onBack: () => void;
  onFinished: (batch: KitchenBatch) => void;
};

export default function BatchProcessRunner({ batch, onBack, onFinished }: BatchProcessRunnerProps) {
  const [typesById, setTypesById] = useState<Record<string, KitchenProcessType>>({});
  const [processes, setProcesses] = useState<KitchenProcess[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentProcess, setCurrentProcess] = useState<KitchenProcess | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [running, setRunning] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showError, setShowError] = useState(false);

  function scheduleErrorReveal() {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setShowError(false);
    errorTimerRef.current = setTimeout(() => setShowError(true), 10_000); // allow slow connections to settle
  }

  function clearErrorTimer() {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        clearErrorTimer();
        setError(null);
        setShowError(false);
        const [procs, pts] = await Promise.all([
          supabaseHelpers.getKitchenProcessesForBatch(batch.id),
          supabaseHelpers.getKitchenProcessTypes(),
        ]);
        if (!mounted) return;
        setProcesses(procs || []);
        setTypesById(Object.fromEntries(pts.map(t => [t.id, t])));
        const firstIncomplete = (procs || []).findIndex(p => !p.end_time);
        const idx = firstIncomplete >= 0 ? firstIncomplete : (procs || []).length - 1;
        setCurrentIndex(Math.max(0, idx));
      } catch (e: any) {
        setError(e?.message || 'Failed to load batch processes');
        scheduleErrorReveal();
      }
    })();
    return () => {
      mounted = false;
      stopTimer();
      clearErrorTimer();
    };
  }, [batch.id]);

  function startTimer(startIso?: string) {
    const start = startIso ? new Date(startIso).getTime() : Date.now();
    // Clear any existing interval BEFORE setting running to avoid flipping it back to false
    stopTimer();
    setElapsedMs(0);
    setRunning(true);
    timerRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 1000);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRunning(false);
  }

  const currentType = useMemo(() => {
    const p = processes[currentIndex];
    return p ? typesById[p.process_type_id] || null : null;
  }, [processes, currentIndex, typesById]);
  const isLast = useMemo(() => currentIndex >= processes.length - 1, [processes, currentIndex]);

  async function handleStart() {
    const p = processes[currentIndex];
    if (!p) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await supabaseHelpers.startPrecreatedKitchenProcess(p.id, { remarks: remarks || undefined });
      setCurrentProcess(updated);
      // replace process in local state
      setProcesses((prev) => prev.map((x, i) => i === currentIndex ? updated : x));
      startTimer(updated.start_time || undefined);
    } catch (e: any) {
      setError(e?.message || 'Failed to start process');
    } finally {
      setLoading(false);
    }
  }

  async function handleNext() {
    if (!currentProcess) return; // must start first
    setLoading(true);
    setError(null);
    try {
      const completed = await supabaseHelpers.endKitchenProcess(currentProcess.id, { remarks: remarks || undefined });
      setProcesses((prev) => prev.map((x, i) => i === currentIndex ? completed : x));
      stopTimer();
      setRemarks('');
      setCurrentProcess(null);
      if (!isLast) {
        setCurrentIndex((i) => i + 1);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to end process');
    } finally {
      setLoading(false);
    }
  }

  async function handleFinishBatch() {
    setLoading(true);
    setError(null);
    try {
      const updated = await supabaseHelpers.finishKitchenBatch(batch.id);
      onFinished(updated);
    } catch (e: any) {
      setError(e?.message || 'Failed to finish batch');
    } finally {
      setLoading(false);
    }
  }

  function formatElapsed(ms: number) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-3xl mx-auto p-3 sm:p-5">
        <div className="mb-6 flex items-center gap-2">
          <button onClick={onBack} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200 hover:border-slate-300" title="Back">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <h1 className="text-lg md:text-2xl font-bold text-slate-800">Batch Process Runner</h1>
        </div>

        {error && showError && <div className="mb-4 text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {processes.length === 0 && (
            <div className="mb-4 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              No processes are configured for this batch. Go to Kitchen Admin → Process Templates to add a template for the selected halwa type, or pre-create processes for the batch.
            </div>
          )}
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="text-sm text-slate-600">Batch</div>
              <div className="text-slate-800 font-semibold">{batch.halwa_type} • {Number(batch.starch_weight)} kg</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-600">Process</div>
              <div className="text-slate-800 font-semibold">{currentType ? currentType.name : 'All processes complete'}</div>
              {currentType && (
                <div className="text-xs text-slate-600">Std: {Number(currentType.standard_duration_minutes)} min ± {Number(currentType.variation_buffer_minutes)} min</div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center py-8">
            <div className="text-6xl font-mono font-bold text-slate-800 mb-3">{formatElapsed(elapsedMs)}</div>
            <div className="text-slate-600 text-sm mb-6">Live stopwatch</div>

            <div className="w-full max-w-md mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Remarks (required for manual adjustments)</label>
              <input value={remarks} onChange={(e) => setRemarks(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Optional notes" />
            </div>

            <div className="flex items-center gap-3">
              {currentType && !currentProcess && (
                <button onClick={handleStart} disabled={loading} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  <Play className="w-5 h-5" /> Start
                </button>
              )}
              {currentProcess && (
                <button onClick={handleNext} disabled={loading} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  <StepForward className="w-5 h-5" /> Next
                </button>
              )}
              {(!currentType || isLast) && !running && (
                <button onClick={handleFinishBatch} disabled={loading} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                  <CheckCircle className="w-5 h-5" /> Finish Batch
                </button>
              )}
            </div>
          </div>

          <div className="mt-6">
              <div className="text-sm font-semibold text-slate-700 mb-2">Process Sequence</div>
            <ol className="list-decimal ml-6 text-slate-700">
              {processes.map((p, idx) => (
                <li key={p.id} className={idx === currentIndex ? 'font-semibold' : ''}>{typesById[p.process_type_id]?.name || p.process_type_id}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
