import { X } from 'lucide-react';
import { Product } from './posTypes';

type ProviderPricingModalProps = {
  show: boolean;
  onClose: () => void;
  selectedProvider: any;
  products: Product[];
  multiplierInput: string;
  onMultiplierChange: (value: string) => void;
  pricingForm: Record<string, string>;
  onOverrideChange: (itemId: string, value: string) => void;
  onSave: () => void;
};

export function ProviderPricingModal({
  show,
  onClose,
  selectedProvider,
  products,
  multiplierInput,
  onMultiplierChange,
  pricingForm,
  onOverrideChange,
  onSave,
}: ProviderPricingModalProps) {
  if (!show || !selectedProvider) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white w-[95vw] max-w-3xl rounded-xl shadow-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Edit Provider Item Pricing</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Default Price Multiplier</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={multiplierInput}
              onChange={(e) => onMultiplierChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
            <p className="text-[11px] text-slate-500 mt-1">Applied to items without explicit override. Leave blank or 0 to disable.</p>
          </div>
          <div className="max-h-[45vh] overflow-auto border border-slate-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2">Item</th>
                  <th className="text-left px-3 py-2">SKU</th>
                  <th className="text-right px-3 py-2">Base Price</th>
                  <th className="text-right px-3 py-2">Override Price</th>
                </tr>
              </thead>
              <tbody>
                {products.map((prod) => (
                  <tr key={prod.id} className="border-t border-slate-200">
                    <td className="px-3 py-2 text-slate-800">{prod.name}</td>
                    <td className="px-3 py-2 text-slate-500">{prod.sku || '-'}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{Number(prod.price).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={pricingForm[prod.id] || ''}
                        onChange={(e) => onOverrideChange(prod.id, e.target.value)}
                        className="w-32 px-2 py-1 border border-slate-200 rounded-lg"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save Pricing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
