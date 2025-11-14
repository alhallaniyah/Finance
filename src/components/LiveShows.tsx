import { useEffect, useMemo, useState } from 'react';
import { supabaseHelpers, LiveShow, LiveShowQuotation, LiveShowPayment } from '../lib/supabaseHelpers';

//

function parseISODate(d?: string | null): Date | null {
  if (!d) return null;
  const parts = d.split('-').map((p) => Number(p));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

type Props = { onOpenDetail?: (id: string) => void };

export default function LiveShows({ onOpenDetail }: Props) {
  const [loading, setLoading] = useState(true);
  const [shows, setShows] = useState<LiveShow[]>([]);
  const [quotesMap, setQuotesMap] = useState<Record<string, LiveShowQuotation[]>>({});
  const [paymentsMap, setPaymentsMap] = useState<Record<string, LiveShowPayment[]>>({});
  const [clientNames, setClientNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const allShows = await supabaseHelpers.getLiveShows();
        const today = new Date();
        const upcomingConfirmed = allShows.filter((s) => {
          const d = parseISODate(s.show_date);
          const isUpcoming = d ? d >= new Date(today.getFullYear(), today.getMonth(), today.getDate()) : true;
          return isUpcoming && (s.status === 'advanced_paid' || s.status === 'fully_paid');
        });

        // Sort by date ascending, then time
        upcomingConfirmed.sort((a, b) => {
          const da = parseISODate(a.show_date)?.getTime() || 0;
          const db = parseISODate(b.show_date)?.getTime() || 0;
          if (da !== db) return da - db;
          const ta = (a.show_time || '').localeCompare(b.show_time || '');
          return ta;
        });

        setShows(upcomingConfirmed);

        // Preload quotations and payments for display
        const [quotesEntries, paymentsEntries] = await Promise.all([
          Promise.all(
            upcomingConfirmed.map(async (s) => {
              const qs = await supabaseHelpers.getLiveShowQuotations(s.id);
              return [s.id, qs] as const;
            })
          ),
          Promise.all(
            upcomingConfirmed.map(async (s) => {
              const ps = await supabaseHelpers.getLiveShowPayments(s.id);
              return [s.id, ps] as const;
            })
          ),
        ]);
        setQuotesMap(Object.fromEntries(quotesEntries));
        setPaymentsMap(Object.fromEntries(paymentsEntries));

        // Preload client names
        const clients = await supabaseHelpers.getClientsCached();
        const names: Record<string, string> = {};
        for (const c of clients) names[c.id] = c.name;
        setClientNames(names);
      } catch (e: any) {
        console.error('Failed to load live shows', e);
        setError(e?.message || 'Failed to load live shows');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function sumPayments(list: LiveShowPayment[], type?: 'advance' | 'full') {
    const arr = type ? list.filter((p) => p.payment_type === type) : list;
    return arr.reduce((sum, p) => sum + Math.max(0, Number(p.amount || 0)), 0);
  }

  const rows = useMemo(() => {
    return shows.map((s) => {
      const qs = quotesMap[s.id] || [];
      const ps = paymentsMap[s.id] || [];
      const estimated = Math.max(0, Number(qs[0]?.total_estimated || 0));
      const advance = sumPayments(ps, 'advance');
      const full = sumPayments(ps, 'full');
      const balance = Math.max(0, estimated - (advance + full));
      return { s, estimated, advance, full, balance };
    });
  }, [shows, quotesMap, paymentsMap]);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-slate-800">Upcoming Confirmed Live Shows</h1>
        <button
          type="button"
          className="px-3 py-2 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
          onClick={() => {
            // force reload by re-running effect
            setShows([]);
            setQuotesMap({});
            setPaymentsMap({});
            setClientNames({});
            setLoading(true);
            setTimeout(() => {
              // trigger load by resetting state (simple approach)
              // eslint-disable-next-line no-self-assign
              window.location.hash = window.location.hash; // no-op to nudge rerender
              setLoading(false);
            }, 0);
          }}
        >
          Refresh
        </button>
      </div>

      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="text-slate-600">Loading live shows…</div>
      ) : rows.length === 0 ? (
        <div className="text-slate-600">No upcoming confirmed live shows.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="text-left px-3 py-2 border-b">ID</th>
                <th className="text-left px-3 py-2 border-b">Show #</th>
                <th className="text-left px-3 py-2 border-b">Date</th>
                <th className="text-left px-3 py-2 border-b">Time</th>
                <th className="text-left px-3 py-2 border-b">Client</th>
                <th className="text-left px-3 py-2 border-b">Location</th>
                <th className="text-left px-3 py-2 border-b">Item</th>
                <th className="text-left px-3 py-2 border-b">Status</th>
                <th className="text-right px-3 py-2 border-b">Estimated</th>
                <th className="text-right px-3 py-2 border-b">Advance</th>
                <th className="text-right px-3 py-2 border-b">Full</th>
                <th className="text-right px-3 py-2 border-b">Balance</th>
              </tr>
            </thead>
            <tbody className="text-slate-800">
              {rows.map(({ s, estimated, advance, full, balance }) => (
                <tr key={s.id} className="even:bg-slate-50">
                  <td className="px-3 py-2 border-b text-xs text-slate-500">
                    {onOpenDetail ? (
                      <button className="underline hover:text-blue-600" onClick={() => onOpenDetail(s.id)}>{s.id}</button>
                    ) : (
                      s.id
                    )}
                  </td>
                  <td className="px-3 py-2 border-b">{s.show_number}</td>
                  <td className="px-3 py-2 border-b">{s.show_date || '-'}</td>
                  <td className="px-3 py-2 border-b">{s.show_time || '-'}</td>
                  <td className="px-3 py-2 border-b">{clientNames[s.client_id] || s.client_id}</td>
                  <td className="px-3 py-2 border-b">{s.location || '-'}</td>
                  <td className="px-3 py-2 border-b">{s.item_name || '-'}</td>
                  <td className="px-3 py-2 border-b">
                    <span className={`px-2 py-1 rounded text-xs ${s.status === 'fully_paid' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{s.status.replace('_', ' ')}</span>
                  </td>
                  <td className="px-3 py-2 border-b text-right">{estimated.toFixed(2)}</td>
                  <td className="px-3 py-2 border-b text-right">{advance.toFixed(2)}</td>
                  <td className="px-3 py-2 border-b text-right">{full.toFixed(2)}</td>
                  <td className="px-3 py-2 border-b text-right">{balance.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}