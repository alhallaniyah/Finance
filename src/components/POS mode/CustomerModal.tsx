import { X } from 'lucide-react';

type CustomerModalProps = {
  show: boolean;
  onClose: () => void;
  clientsLoading: boolean;
  existingClients: any[];
  onSelectClient: (client: any) => void;
};

export function CustomerModal({
  show,
  onClose,
  clientsLoading,
  existingClients,
  onSelectClient,
}: CustomerModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white w-[90vw] max-w-2xl rounded-xl shadow-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Select Customer</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        {clientsLoading ? (
          <div className="p-6 text-center text-slate-500">Loading customers...</div>
        ) : (
          <div className="max-h-80 overflow-auto divide-y divide-slate-200">
            {existingClients.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelectClient(c)}
                className="w-full text-left p-3 hover:bg-slate-50"
              >
                <p className="font-medium text-slate-800">{c.name || 'Unnamed'}</p>
                <p className="text-xs text-slate-500">{c.phone || 'No phone'}</p>
              </button>
            ))}
            {existingClients.length === 0 && (
              <div className="p-6 text-center text-slate-500">No customers found</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
