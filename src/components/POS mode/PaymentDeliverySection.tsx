type PaymentOption = { value: string; label: string };

type PaymentDeliverySectionProps = {
  mode: 'in_store' | 'delivery' | 'live_show';
  paymentMethod: string;
  onPaymentMethodChange: (value: string) => void;
  inStorePaymentOptions: PaymentOption[];
  deliveryPaymentOptions: PaymentOption[];
  cardPaymentAmount: number;
  onCardPaymentAmountChange: (value: string) => void;
  cardAmount: number;
  cashAmount: number;
  deliveryFee: number;
  onDeliveryFeeChange: (value: number) => void;
  providerManaged: boolean;
  providers: Array<{ id: string; name: string; phone: string; managerPhone?: string; managed?: boolean }>;
  selectedProviderId: string;
  onProviderChange: (value: string) => void;
  selectedProvider: any;
  onShowPricingModal: () => void;
  total: number;
};

export function PaymentDeliverySection({
  mode,
  paymentMethod,
  onPaymentMethodChange,
  inStorePaymentOptions,
  deliveryPaymentOptions,
  cardPaymentAmount,
  onCardPaymentAmountChange,
  cardAmount,
  cashAmount,
  deliveryFee,
  onDeliveryFeeChange,
  providerManaged,
  providers,
  selectedProviderId,
  onProviderChange,
  selectedProvider,
  onShowPricingModal,
  total,
}: PaymentDeliverySectionProps) {
  if (mode === 'live_show') return null;

  return (
    <div className="border-t border-slate-200 pt-4 mt-4 mb-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-2">Payment & Delivery</h3>
      {mode === 'in_store' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => onPaymentMethodChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {inStorePaymentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {paymentMethod === 'both' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Card Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cardPaymentAmount.toFixed(2)}
                  onChange={(e) => onCardPaymentAmountChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
              <p className="text-xs text-slate-500 mb-1">Card Amount</p>
              <p className="text-sm font-semibold text-slate-800">{cardAmount.toFixed(2)}</p>
            </div>
            <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
              <p className="text-xs text-slate-500 mb-1">Cash Amount</p>
              <p className="text-sm font-semibold text-slate-800">{cashAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>
      ) : mode === 'delivery' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => onPaymentMethodChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {deliveryPaymentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Delivery Fee (Reference)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={deliveryFee}
                onChange={(e) => {
                  const parsed = parseFloat(e.target.value);
                  onDeliveryFeeChange(Number.isFinite(parsed) ? parsed : 0);
                }}
                disabled={providerManaged}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {providerManaged && (
                <p className="text-xs text-emerald-600 mt-1">Managed provider: delivery fee is exempt.</p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Delivery Provider</label>
            <select
              value={selectedProviderId}
              onChange={(e) => onProviderChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>
          <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
            {selectedProvider ? (
              <>
                <p className="text-sm font-semibold text-slate-800">{selectedProvider.name}</p>
                <p className="text-xs text-slate-500">Phone: {selectedProvider.phone}</p>
                <p className="text-xs text-slate-500">Manager: {selectedProvider.managerPhone}</p>
                <span
                  className={`mt-2 inline-flex px-2 py-1 rounded-full text-[11px] font-medium ${
                    providerManaged ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {providerManaged ? 'Managed Provider' : 'Unmanaged Provider'}
                </span>
                {providerManaged && (
                  <p className="text-xs text-emerald-600 mt-2">Customer details optional for managed providers.</p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-xs text-slate-600">
                    Provider Pricing: Multiplier {typeof selectedProvider.priceMultiplier !== 'undefined' && selectedProvider.priceMultiplier !== null ? String(Number(selectedProvider.priceMultiplier)) : '-'}, Overrides {Array.isArray(selectedProvider.priceOverrides) ? selectedProvider.priceOverrides.length : 0}
                  </div>
                  <button
                    onClick={onShowPricingModal}
                    className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white hover:bg-slate-50"
                  >
                    Edit Item Pricing
                  </button>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500">Select a delivery provider to view details.</p>
            )}
          </div>
          {paymentMethod === 'cod' && (
            <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
              <p className="text-xs text-slate-500 mb-1">COD Amount</p>
              <p className="text-sm font-semibold text-slate-800">{cashAmount.toFixed(2)}</p>
            </div>
          )}
          {paymentMethod === 'provider' && (
            <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
              <p className="text-xs text-slate-500 mb-1">Provider Collect Amount</p>
              <p className="text-sm font-semibold text-slate-800">{total.toFixed(2)}</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
