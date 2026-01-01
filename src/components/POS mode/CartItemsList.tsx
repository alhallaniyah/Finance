import { Trash2 } from 'lucide-react';
import { CartItem } from './posTypes';

type CartItemsListProps = {
  cart: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onUpdateWeight: (id: string, weight: number) => void;
  onUpdateSellBy: (id: string, sellBy: 'unit' | 'weight') => void;
  onRemoveItem: (id: string) => void;
};

export function CartItemsList({
  cart,
  onUpdateQuantity,
  onUpdateWeight,
  onUpdateSellBy,
  onRemoveItem,
}: CartItemsListProps) {
  return (
    <div className="space-y-3 mb-4">
      {cart.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-3 border border-slate-200 rounded-lg p-3">
          <div>
            <p className="font-medium text-slate-800">{item.name}</p>
            <p className="text-xs text-slate-500">{item.unitPrice.toFixed(2)} {item.sell_by === 'weight' ? 'per kg' : 'each'}</p>
          </div>
          <div className="flex items-center gap-2">
            {!item.itemId ? (
              <div className="inline-flex rounded-md border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => onUpdateSellBy(item.id, 'unit')}
                  className={`px-2 py-1 text-xs ${item.sell_by === 'unit' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}
                >
                  Unit
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSellBy(item.id, 'weight')}
                  className={`px-2 py-1 text-xs ${item.sell_by === 'weight' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}
                >
                  Weight
                </button>
              </div>
            ) : (
              <span className="px-2 py-1 text-xs rounded border border-slate-200 text-slate-700">
                {item.sell_by === 'weight' ? 'Weight' : 'Unit'}
              </span>
            )}
            {item.sell_by === 'weight' && (
              <>
                <button
                  type="button"
                  onClick={() => onUpdateWeight(item.id, 0.5)}
                  className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded"
                >
                  0.5 kg
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateWeight(item.id, 1)}
                  className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded"
                >
                  1 kg
                </button>
              </>
            )}
            <div className="flex flex-col items-start">
              <label className="text-[10px] font-medium text-slate-600 mb-1">Quantity</label>
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) => onUpdateQuantity(item.id, Number(e.target.value))}
                className="w-20 px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div className="flex flex-col items-start">
              <label className="text-[10px] font-medium text-slate-600 mb-1">Weight</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={item.weight ?? 0}
                onChange={(e) => onUpdateWeight(item.id, Number(e.target.value))}
                className="w-24 px-3 py-2 border border-slate-200 rounded-lg"
                disabled={item.sell_by === 'unit'}
                placeholder="kg"
              />
            </div>
            <button
              onClick={() => onRemoveItem(item.id)}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
              title="Remove"
            >
              <Trash2 className="w-4 h-4 text-slate-700" />
            </button>
          </div>
        </div>
      ))}
      {cart.length === 0 && <div className="text-sm text-slate-500">No items in cart</div>}
    </div>
  );
}
