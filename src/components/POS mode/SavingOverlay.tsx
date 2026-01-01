type SavingOverlayProps = {
  saving: boolean;
};

export function SavingOverlay({ saving }: SavingOverlayProps) {
  if (!saving) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 w-[90vw] max-w-sm text-center">
        <div className="animate-spin h-6 w-6 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto mb-3"></div>
        <div className="text-slate-800 font-semibold mb-1">Saving order...</div>
        <div className="text-slate-600 text-sm">Please wait, this may take a moment.</div>
      </div>
    </div>
  );
}
