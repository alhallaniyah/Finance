import { Trash2 } from 'lucide-react';
import { FormItem } from './documentFormTypes';

type DocumentItemRowProps = {
  item: FormItem;
  isLiveShowQuotation: boolean;
  onUpdateItem: (id: string, field: keyof FormItem, value: string | number) => void;
  onRemoveItem: (id: string) => void;
};

export function DocumentItemRow({
  item,
  isLiveShowQuotation,
  onUpdateItem,
  onRemoveItem,
}: DocumentItemRowProps) {
  return (
    <div className="flex gap-3 items-start bg-slate-50 p-4 rounded-lg">
      <div className="flex-1">
        {!isLiveShowQuotation && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-slate-600">Sell by:</span>
            <div className="inline-flex rounded-md border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={() => onUpdateItem(item.id, 'sell_by', 'unit')}
                className={`px-3 py-1 text-xs ${item.sell_by === 'unit' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}
              >
                Unit
              </button>
              <button
                type="button"
                onClick={() => onUpdateItem(item.id, 'sell_by', 'weight')}
                className={`px-3 py-1 text-xs ${item.sell_by === 'weight' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}
              >
                Weight
              </button>
            </div>
            {item.sell_by === 'weight' && (
              <div className="flex items-center gap-2 ml-2">
                <button
                  type="button"
                  onClick={() => onUpdateItem(item.id, 'weight', 0.5)}
                  className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded"
                >
                  0.5 kg
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateItem(item.id, 'weight', 1)}
                  className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded"
                >
                  1 kg
                </button>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5">
            <input
              type="text"
              placeholder="Description"
              value={item.description}
              onChange={(e) => onUpdateItem(item.id, 'description', e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="md:col-span-2">
            <input
              type="number"
              placeholder="Qty"
              value={item.quantity}
              onChange={(e) => onUpdateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
              min="0"
              step="0.01"
              required={item.sell_by === 'unit'}
              disabled={!isLiveShowQuotation && item.sell_by === 'weight'}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {!isLiveShowQuotation && (
            <div className="md:col-span-2">
              <input
                type="number"
                placeholder="Weight"
                value={item.weight}
                onChange={(e) => onUpdateItem(item.id, 'weight', parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
                required={item.sell_by === 'weight'}
                disabled={item.sell_by === 'unit'}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}
          <div className="md:col-span-2">
            <input
              type="number"
              placeholder={!isLiveShowQuotation && item.sell_by === 'weight' ? 'Price per kg' : 'Unit price'}
              value={item.unit_price}
              onChange={(e) => onUpdateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
              min="0"
              step="0.000001"
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="md:col-span-3">
            <input
              type="text"
              value={item.amount.toFixed(2)}
              disabled
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-600"
            />
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRemoveItem(item.id)}
        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  );
}
