import { Plus } from 'lucide-react';
import { FormItem } from './documentFormTypes';
import { DocumentItemRow } from './DocumentItemRow';

type ItemsSectionProps = {
  items: FormItem[];
  isLiveShowQuotation: boolean;
  onAddItem: () => void;
  onUpdateItem: (id: string, field: keyof FormItem, value: string | number) => void;
  onRemoveItem: (id: string) => void;
};

export function ItemsSection({
  items,
  isLiveShowQuotation,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: ItemsSectionProps) {
  return (
    <div className="border-t border-slate-200 pt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-800">Items</h3>
        <button
          type="button"
          onClick={onAddItem}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <DocumentItemRow
            key={item.id}
            item={item}
            isLiveShowQuotation={isLiveShowQuotation}
            onUpdateItem={onUpdateItem}
            onRemoveItem={onRemoveItem}
          />
        ))}
      </div>
    </div>
  );
}
