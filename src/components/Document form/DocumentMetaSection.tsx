import { Status, originLabels } from './documentFormTypes';

type DocumentMetaSectionProps = {
  documentNumber: string;
  documentOrigin: 'dashboard' | 'pos_in_store' | 'pos_delivery';
  status: Status;
  issueDate: string;
  dueDate: string;
  onStatusChange: (value: Status) => void;
  onIssueDateChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
};

export function DocumentMetaSection({
  documentNumber,
  documentOrigin,
  status,
  issueDate,
  dueDate,
  onStatusChange,
  onIssueDateChange,
  onDueDateChange,
}: DocumentMetaSectionProps) {
  const originClass =
    documentOrigin === 'dashboard'
      ? 'bg-slate-50 text-slate-600'
      : documentOrigin === 'pos_in_store'
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-orange-50 text-orange-700';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Document Number</label>
        <input
          type="text"
          value={documentNumber}
          disabled
          className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Document Source</label>
        <div className={`w-full px-4 py-2 rounded-lg border border-slate-200 ${originClass}`}>
          {originLabels[documentOrigin]}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value as Status)}
          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Issue Date</label>
        <input
          type="date"
          value={issueDate}
          onChange={(e) => onIssueDateChange(e.target.value)}
          required
          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Due Date</label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => onDueDateChange(e.target.value)}
          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    </div>
  );
}
