import { Home, MapPin, Package, Phone, User } from 'lucide-react';
import { Customer, EMIRATES } from './posTypes';

type CustomerDetailsSectionProps = {
  customer: Customer;
  onCustomerChange: (customer: Customer) => void;
  mode: 'in_store' | 'delivery' | 'live_show';
  orderDate: string;
  onOrderDateChange: (value: string) => void;
  onOpenCustomerModal: () => void;
  onConfirmOrder: () => void;
  saving: boolean;
};

export function CustomerDetailsSection({
  customer,
  onCustomerChange,
  mode,
  orderDate,
  onOrderDateChange,
  onOpenCustomerModal,
  onConfirmOrder,
  saving,
}: CustomerDetailsSectionProps) {
  return (
    <div className="border-t border-slate-200 pt-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-2">Customer Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Customer name"
            value={customer.name}
            onChange={(e) => onCustomerChange({ ...customer, name: e.target.value })}
            className="w-full pl-9 px-3 py-2 border border-slate-200 rounded-lg"
          />
        </div>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="tel"
            placeholder="Phone number"
            value={customer.phone}
            onChange={(e) => onCustomerChange({ ...customer, phone: e.target.value })}
            className="w-full pl-9 px-3 py-2 border border-slate-200 rounded-lg"
          />
        </div>
      </div>

      {mode === 'delivery' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div className="relative">
            <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Delivery address"
              value={customer.address}
              onChange={(e) => onCustomerChange({ ...customer, address: e.target.value })}
              className="w-full pl-9 px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={customer.emirate}
              onChange={(e) => onCustomerChange({ ...customer, emirate: e.target.value })}
              className="w-full pl-9 px-3 py-2 border border-slate-200 rounded-lg"
            >
              <option value="">Select Emirate</option>
              {EMIRATES.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {mode !== 'live_show' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Order Date</label>
            <input
              type="date"
              value={orderDate}
              onChange={(e) => onOrderDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
            <p className="text-xs text-slate-500 mt-1">Defaults to today; used as issue date.</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={onOpenCustomerModal}
          className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <User className="w-4 h-4" /> Select Existing Customer
        </button>
        <button
          onClick={onConfirmOrder}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Package className="w-4 h-4" /> {saving ? 'Processing...' : (mode === 'live_show' ? 'Create Quotation' : 'Confirm Order')}
        </button>
      </div>
    </div>
  );
}
