import { ArrowLeft, Store, Timer, Truck } from 'lucide-react';

type POSModeHeaderProps = {
  mode: 'in_store' | 'delivery' | 'live_show';
  onModeChange: (mode: 'in_store' | 'delivery' | 'live_show') => void;
  onBack: () => void;
  onOpenKitchen?: () => void;
  userRole: 'admin' | 'manager' | 'sales' | null;
};

export function POSModeHeader({
  mode,
  onModeChange,
  onBack,
  onOpenKitchen,
  userRole,
}: POSModeHeaderProps) {
  return (
    <header className="mb-6">
      <div className="flex items-center gap-3">
        {userRole === 'sales' ? (
          <button
            onClick={() => onOpenKitchen && onOpenKitchen()}
            className="inline-flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg shadow-sm hover:bg-teal-700"
            title="Go to Kitchen"
          >
            <Timer className="w-4 h-4" />
            Kitchen
          </button>
        ) : (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}
        <h1 className="text-2xl font-bold text-slate-800">POS Mode</h1>
      </div>
      <nav className="mt-3" aria-label="POS navigation">
        <div className="bg-slate-100 border border-slate-200 rounded-lg p-1.5 overflow-x-auto">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <button
              onClick={() => onModeChange('in_store')}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium ${
                mode === 'in_store'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'bg-transparent text-slate-700 hover:bg-white/60 border border-transparent'
              }`}
              aria-current={mode === 'in_store' ? 'page' : undefined}
            >
              <Store className="w-3.5 h-3.5" /> In-Store Sale
            </button>
            <button
              onClick={() => onModeChange('delivery')}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium ${
                mode === 'delivery'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'bg-transparent text-slate-700 hover:bg-white/60 border border-transparent'
              }`}
              aria-current={mode === 'delivery' ? 'page' : undefined}
            >
              <Truck className="w-3.5 h-3.5" /> Delivery Sale
            </button>
            <button
              onClick={() => onModeChange('live_show')}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium ${
                mode === 'live_show'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'bg-transparent text-slate-700 hover:bg-white/60 border border-transparent'
              }`}
              aria-current={mode === 'live_show' ? 'page' : undefined}
            >
              <Timer className="w-3.5 h-3.5" /> Live Show
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
}
