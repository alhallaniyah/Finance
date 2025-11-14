import { useEffect, useMemo, useState } from 'react';
import { supabaseHelpers, LiveShow } from '../lib/supabaseHelpers';
import { Calendar, ChevronLeft, ChevronRight, Truck, Mic } from 'lucide-react';

type CalendarEvent = {
  kind: 'live_show' | 'delivery';
  date: string; // YYYY-MM-DD
  title: string;
  time?: string | null;
};

function formatISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}


function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function addDays(d: Date, n: number): Date { const t = new Date(d); t.setDate(t.getDate() + n); return t; }

export default function CalendarView() {
  const [month, setMonth] = useState<Date>(() => new Date());
  const [eventsByDate, setEventsByDate] = useState<Record<string, CalendarEvent[]>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Clients map is derived ad-hoc; no need to store full clients state

  const monthStart = useMemo(() => startOfMonth(month), [month]);
  const monthEnd = useMemo(() => endOfMonth(month), [month]);
  const todayStr = useMemo(() => formatISODate(new Date()), []);

  const gridDays = useMemo(() => {
    // Start calendar on Sunday
    const startIdx = monthStart.getDay();
    const firstGridDay = addDays(monthStart, -startIdx);
    // 6 rows * 7 cols = 42 days
    return Array.from({ length: 42 }, (_, i) => addDays(firstGridDay, i));
  }, [monthStart]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const startIso = formatISODate(monthStart);
        const endIso = formatISODate(monthEnd);
        const [showsAll, deliveryNotes, clientsList] = await Promise.all([
          supabaseHelpers.getLiveShows(),
          supabaseHelpers.getDeliveryNotesBetween(startIso, endIso),
          supabaseHelpers.getClientsCached(),
        ]);
        if (!mounted) return;
        // Filter live shows in range and confirmed
        const showsInRange = (showsAll || []).filter((s: LiveShow) => {
          if (!s.show_date) return false;
          const d = s.show_date;
          return d >= startIso && d <= endIso && (s.status === 'advanced_paid' || s.status === 'fully_paid');
        });

        const clientMap: Record<string, string> = {};
        for (const c of clientsList) {
          if (c.id) clientMap[c.id] = c.name || c.id;
        }

        const evMap: Record<string, CalendarEvent[]> = {};
        for (const s of showsInRange) {
          const labelParts = [
            clientMap[s.client_id] || 'Unknown Client',
            s.item_name ? `• ${s.item_name}` : '',
            s.location ? `• ${s.location}` : '',
          ].filter(Boolean);
          const title = `Live Show: ${labelParts.join(' ')}`;
          const ev: CalendarEvent = { kind: 'live_show', date: s.show_date!, title, time: s.show_time || null };
          if (!evMap[ev.date]) evMap[ev.date] = [];
          evMap[ev.date].push(ev);
        }

        for (const d of deliveryNotes || []) {
          const date = d.issue_date || undefined;
          if (!date) continue;
          const title = `Delivery: ${d.client_name || ''} • ${d.document_number}`.trim();
          const ev: CalendarEvent = { kind: 'delivery', date, title };
          if (!evMap[date]) evMap[date] = [];
          evMap[date].push(ev);
        }

        setEventsByDate(evMap);
      } catch (e: any) {
        console.error('Failed to load calendar data', e);
        if (mounted) setError(e?.message || 'Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [monthStart, monthEnd]);

  function prevMonth() { setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1)); }
  function nextMonth() { setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1)); }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-slate-700" />
          <h2 className="text-lg font-semibold text-slate-800">
            {month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={prevMonth} className="px-2 py-1 border rounded hover:bg-slate-50" title="Previous Month">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={nextMonth} className="px-2 py-1 border rounded hover:bg-slate-50" title="Next Month">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 text-sm text-red-600">{error}</div>
      )}
      {loading && (
        <div className="mb-3 text-sm text-slate-600">Loading calendar…</div>
      )}

      <div className="grid grid-cols-7 gap-2">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
          <div key={d} className="text-xs font-semibold text-slate-600 px-1">{d}</div>
        ))}
        {gridDays.map((d, idx) => {
          const ds = formatISODate(d);
          const inMonth = d.getMonth() === month.getMonth();
          const isToday = ds === todayStr;
          const events = eventsByDate[ds] || [];
          return (
            <div key={idx} className={`border rounded p-2 min-h-[96px] ${inMonth ? 'bg-white' : 'bg-slate-50'} ${isToday ? 'ring-2 ring-blue-400' : ''}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs ${inMonth ? 'text-slate-700' : 'text-slate-400'}`}>{d.getDate()}</span>
                {events.length > 0 && (
                  <span className="text-[10px] text-slate-500">{events.length} events</span>
                )}
              </div>
              <div className="space-y-1">
                {events.map((ev, i) => {
                  const futureDelivery = ev.kind === 'delivery' && ds > todayStr;
                  return (
                    <div key={i} className={`text-[11px] border rounded px-1 py-0.5 flex items-center gap-1 ${ev.kind === 'live_show' ? 'bg-emerald-50 border-emerald-200' : futureDelivery ? 'bg-sky-50 border-sky-200' : 'bg-slate-50 border-slate-200'}`}>
                      {ev.kind === 'live_show' ? (
                        <Mic className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Truck className="w-3 h-3 text-sky-600" />
                      )}
                      <span className="truncate">
                        {ev.title}{ev.kind === 'live_show' && ev.time ? ` • ${ev.time}` : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}