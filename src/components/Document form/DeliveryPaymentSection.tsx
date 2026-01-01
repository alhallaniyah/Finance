import { DeliveryProviderOption } from '../../data/deliveryProviders';
import { deliveryPaymentOptions } from './documentFormTypes';

type DeliveryPaymentSectionProps = {
  paymentMethod: 'cod' | 'transfer';
  onPaymentMethodChange: (value: 'cod' | 'transfer') => void;
  deliveryFee: number;
  onDeliveryFeeChange: (value: number) => void;
  deliveryProviderId: string;
  onDeliveryProviderChange: (value: string) => void;
  deliveryProviderName: string;
  deliveryProviderPhone: string;
  deliveryProviderManagerPhone: string;
  deliveryProviderManaged: boolean;
  providers: DeliveryProviderOption[];
};

export function DeliveryPaymentSection({
  paymentMethod,
  onPaymentMethodChange,
  deliveryFee,
  onDeliveryFeeChange,
  deliveryProviderId,
  onDeliveryProviderChange,
  deliveryProviderName,
  deliveryProviderPhone,
  deliveryProviderManagerPhone,
  deliveryProviderManaged,
  providers,
}: DeliveryPaymentSectionProps) {
  return (
    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method</label>
        <select
          value={paymentMethod}
          onChange={(e) => onPaymentMethodChange(e.target.value as 'cod' | 'transfer')}
          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {deliveryPaymentOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Delivery Fee (Reference)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={deliveryFee}
          onChange={(e) => onDeliveryFeeChange(parseFloat(e.target.value) || 0)}
          required
          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Delivery Provider</label>
        <select
          value={deliveryProviderId}
          onChange={(e) => onDeliveryProviderChange(e.target.value)}
          required
          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select provider</option>
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name}
            </option>
          ))}
        </select>
      </div>
      <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
        {deliveryProviderName ? (
          <>
            <p className="text-sm font-semibold text-slate-800">{deliveryProviderName}</p>
            {deliveryProviderPhone && (
              <p className="text-xs text-slate-600">Phone: {deliveryProviderPhone}</p>
            )}
            {deliveryProviderManagerPhone && (
              <p className="text-xs text-slate-600">Manager: {deliveryProviderManagerPhone}</p>
            )}
            <span
              className={`mt-2 inline-flex px-2 py-1 rounded-full text-[11px] font-medium ${
                deliveryProviderManaged ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {deliveryProviderManaged ? 'Managed Provider' : 'Unmanaged Provider'}
            </span>
          </>
        ) : (
          <p className="text-xs text-slate-500">Select a delivery provider to view details.</p>
        )}
      </div>
    </div>
  );
}
