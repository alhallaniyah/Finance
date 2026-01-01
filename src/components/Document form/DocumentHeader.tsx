import { ArrowLeft } from 'lucide-react';

type DocumentHeaderProps = {
  title: string;
  onBack: () => void;
};

export function DocumentHeader({ title, onBack }: DocumentHeaderProps) {
  return (
    <div className="mb-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Dashboard
      </button>
      <h1 className="text-2xl font-bold text-slate-800 mt-6 capitalize">{title}</h1>
    </div>
  );
}
