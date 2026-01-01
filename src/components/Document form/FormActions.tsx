import { Printer, Save } from 'lucide-react';

type FormActionsProps = {
  loading: boolean;
  submitAction: 'save' | 'saveAndPrint';
  onCancel: () => void;
  onSaveAction: () => void;
  onSaveAndPrintAction: () => void;
};

export function FormActions({
  loading,
  submitAction,
  onCancel,
  onSaveAction,
  onSaveAndPrintAction,
}: FormActionsProps) {
  return (
    <div className="flex justify-end gap-3 pt-6">
      <button
        type="button"
        onClick={onCancel}
        className="px-6 py-3 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={loading}
        onClick={onSaveAndPrintAction}
        className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Printer className="w-5 h-5" />
        {loading && submitAction === 'saveAndPrint' ? 'Saving...' : 'Save & Print'}
      </button>
      <button
        type="submit"
        disabled={loading}
        onClick={onSaveAction}
        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Save className="w-5 h-5" />
        {loading && submitAction === 'save' ? 'Saving...' : 'Save Document'}
      </button>
    </div>
  );
}
