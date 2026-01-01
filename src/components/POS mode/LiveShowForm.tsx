type LiveShowFormProps = {
  lsItemName: string;
  onLsItemNameChange: (value: string) => void;
  lsKg: number;
  onLsKgChange: (value: number) => void;
  lsPeopleCount: number;
  onLsPeopleCountChange: (value: number) => void;
  lsDate: string;
  onLsDateChange: (value: string) => void;
  lsTime: string;
  onLsTimeChange: (value: string) => void;
  lsLocation: string;
  onLsLocationChange: (value: string) => void;
  lsNotes: string;
  onLsNotesChange: (value: string) => void;
  estimatedTotal: number;
  onEstimatedTotalChange: (value: number) => void;
};

export function LiveShowForm({
  lsItemName,
  onLsItemNameChange,
  lsKg,
  onLsKgChange,
  lsPeopleCount,
  onLsPeopleCountChange,
  lsDate,
  onLsDateChange,
  lsTime,
  onLsTimeChange,
  lsLocation,
  onLsLocationChange,
  lsNotes,
  onLsNotesChange,
  estimatedTotal,
  onEstimatedTotalChange,
}: LiveShowFormProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Item Name</label>
          <input
            type="text"
            value={lsItemName}
            onChange={(e) => onLsItemNameChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">KG</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={lsKg}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              onLsKgChange(Number.isFinite(v) ? v : 0);
            }}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">People Count</label>
          <input
            type="number"
            min="0"
            value={lsPeopleCount}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              onLsPeopleCountChange(Number.isFinite(v) ? v : 0);
            }}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
          <input
            type="date"
            value={lsDate}
            onChange={(e) => onLsDateChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Time</label>
          <input
            type="time"
            value={lsTime}
            onChange={(e) => onLsTimeChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
          <input
            type="text"
            value={lsLocation}
            onChange={(e) => onLsLocationChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
        <textarea
          rows={3}
          value={lsNotes}
          onChange={(e) => onLsNotesChange(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Estimated Total</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={estimatedTotal}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onEstimatedTotalChange(Number.isFinite(v) ? v : 0);
          }}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg"
        />
        <p className="text-xs text-slate-500 mt-1">Company tax rate applies.</p>
      </div>
    </div>
  );
}
