import { Client } from '../../lib/supabaseHelpers';
import { emirateOptions } from './documentFormTypes';

type ClientInfoSectionProps = {
  clients: Client[];
  clientId: string;
  onClientSelect: (value: string) => void;
  clientName: string;
  onClientNameChange: (value: string) => void;
  clientEmail: string;
  onClientEmailChange: (value: string) => void;
  clientPhone: string;
  onClientPhoneChange: (value: string) => void;
  clientTrn: string;
  onClientTrnChange: (value: string) => void;
  clientEmirate: string;
  onClientEmirateChange: (value: string) => void;
  clientAddress: string;
  onClientAddressChange: (value: string) => void;
};

export function ClientInfoSection({
  clients,
  clientId,
  onClientSelect,
  clientName,
  onClientNameChange,
  clientEmail,
  onClientEmailChange,
  clientPhone,
  onClientPhoneChange,
  clientTrn,
  onClientTrnChange,
  clientEmirate,
  onClientEmirateChange,
  clientAddress,
  onClientAddressChange,
}: ClientInfoSectionProps) {
  return (
    <div className="border-t border-slate-200 pt-6">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Client Information</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">Select Existing Client</label>
          <select
            value={clientId}
            onChange={(e) => onClientSelect(e.target.value)}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">-- New Client --</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Client Name *</label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => onClientNameChange(e.target.value)}
            required
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
          <input
            type="email"
            value={clientEmail}
            onChange={(e) => onClientEmailChange(e.target.value)}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
          <input
            type="tel"
            value={clientPhone}
            onChange={(e) => onClientPhoneChange(e.target.value)}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">TRN</label>
          <input
            type="text"
            value={clientTrn}
            onChange={(e) => onClientTrnChange(e.target.value)}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Emirate</label>
          <select
            value={clientEmirate}
            onChange={(e) => onClientEmirateChange(e.target.value)}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="">Select Emirate</option>
            {emirateOptions.map((emirate) => (
              <option key={emirate} value={emirate}>
                {emirate}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
          <textarea
            value={clientAddress}
            onChange={(e) => onClientAddressChange(e.target.value)}
            rows={2}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );
}
