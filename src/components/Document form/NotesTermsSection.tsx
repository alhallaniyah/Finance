type NotesTermsSectionProps = {
  notes: string;
  onNotesChange: (value: string) => void;
  terms: string;
  onTermsChange: (value: string) => void;
};

export function NotesTermsSection({
  notes,
  onNotesChange,
  terms,
  onTermsChange,
}: NotesTermsSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Terms & Conditions</label>
        <textarea
          value={terms}
          onChange={(e) => onTermsChange(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    </div>
  );
}
