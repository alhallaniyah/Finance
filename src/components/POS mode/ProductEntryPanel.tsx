import { Plus, Search } from 'lucide-react';
import { Product } from './posTypes';

type ProductEntryPanelProps = {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  filteredProducts: Product[];
  onAddToCart: (product: Product) => void;
  customSellBy: 'unit' | 'weight';
  onCustomSellByChange: (value: 'unit' | 'weight') => void;
  onAddCustomItem: (name: string, price: string, qty: string, weight?: string) => void;
};

export function ProductEntryPanel({
  searchTerm,
  onSearchTermChange,
  filteredProducts,
  onAddToCart,
  customSellBy,
  onCustomSellByChange,
  onAddCustomItem,
}: ProductEntryPanelProps) {
  return (
    <>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search items by name or SKU"
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {filteredProducts.map((p) => (
          <button
            key={p.id}
            onClick={() => onAddToCart(p)}
            className="text-left p-4 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center justify-between"
          >
            <div>
              <p className="font-medium text-slate-800">{p.name}</p>
              {p.sku && <p className="text-xs text-slate-500">SKU: {p.sku}</p>}
            </div>
            <span className="text-slate-700">{p.price.toFixed(2)}</span>
          </button>
        ))}
        {filteredProducts.length === 0 && (
          <div className="text-sm text-slate-500">No items found</div>
        )}
      </div>

      <div className="border-t border-slate-200 pt-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Quick Add Custom Item</h3>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-slate-600">Sell by:</span>
          <div className="inline-flex rounded-md border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => onCustomSellByChange('unit')}
              className={`px-3 py-1 text-xs ${customSellBy === 'unit' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}
            >
              Unit
            </button>
            <button
              type="button"
              onClick={() => onCustomSellByChange('weight')}
              className={`px-3 py-1 text-xs ${customSellBy === 'weight' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}
            >
              Weight
            </button>
          </div>
          {customSellBy === 'weight' && (
            <div className="flex items-center gap-2 ml-2">
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('pos-custom-weight') as HTMLInputElement;
                  if (el) el.value = '0.5';
                }}
                className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded"
              >
                0.5 kg
              </button>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('pos-custom-weight') as HTMLInputElement;
                  if (el) el.value = '1';
                }}
                className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded"
              >
                1 kg
              </button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            id="pos-custom-name"
            type="text"
            placeholder="Item description"
            className="px-3 py-2 border border-slate-200 rounded-lg"
          />
          <input
            id="pos-custom-price"
            type="number"
            placeholder={customSellBy === 'weight' ? 'Price per kg' : 'Unit price'}
            className="px-3 py-2 border border-slate-200 rounded-lg"
          />
          <div className="flex flex-col">
            <label htmlFor="pos-custom-qty" className="text-[10px] font-medium text-slate-600 mb-1">Quantity</label>
            <input
              id="pos-custom-qty"
              type="number"
              placeholder="Qty"
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="pos-custom-weight" className="text-[10px] font-medium text-slate-600 mb-1">Weight</label>
            <input
              id="pos-custom-weight"
              type="number"
              placeholder="kg"
              disabled={customSellBy === 'unit'}
              className="px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
        </div>
        <button
          onClick={() => {
            const name = (document.getElementById('pos-custom-name') as HTMLInputElement)?.value || '';
            const price = (document.getElementById('pos-custom-price') as HTMLInputElement)?.value || '';
            const qty = (document.getElementById('pos-custom-qty') as HTMLInputElement)?.value || '';
            const weight = (document.getElementById('pos-custom-weight') as HTMLInputElement)?.value || '';
            onAddCustomItem(name, price, qty, weight);
          }}
          className="mt-3 inline-flex items-center gap-2 px-3 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900"
        >
          <Plus className="w-4 h-4" /> Add to Cart
        </button>
      </div>
    </>
  );
}
