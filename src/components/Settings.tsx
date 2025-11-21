import { useState, useEffect } from 'react';
import { supabaseHelpers } from '../lib/supabaseHelpers';
import { ArrowLeft, Save, Calendar as CalendarIcon, Link as LinkIcon } from 'lucide-react';

type SettingsProps = {
  onBack: () => void;
};

export default function Settings({ onBack }: SettingsProps) {
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyTrn, setCompanyTrn] = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState('');
  const [companyStampUrl, setCompanyStampUrl] = useState('');
  const [defaultTerms, setDefaultTerms] = useState('');
  const [taxRate, setTaxRate] = useState(5);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const data = await supabaseHelpers.getCompanySettings();

    if (data) {
      setSettingsId(data.id);
      setCompanyName(data.company_name || '');
      setCompanyAddress(data.company_address || '');
      setCompanyTrn(data.company_trn || '');
      setCompanyLogoUrl(data.company_logo_url || '');
      setCompanyStampUrl((data as any).company_stamp_url || '');
      setDefaultTerms(data.default_terms || '');
      setTaxRate(Number(data.tax_rate) || 5);
    }
  }

  async function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const url = await supabaseHelpers.uploadCompanyAsset(file, 'logo');
      setCompanyLogoUrl(url);
    } catch (err: any) {
      console.error('Logo upload failed', err);
      alert(err?.message || 'Failed to upload logo.');
    } finally {
      setLoading(false);
    }
  }

  async function handleStampFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const url = await supabaseHelpers.uploadCompanyAsset(file, 'stamp');
      setCompanyStampUrl(url);
    } catch (err: any) {
      console.error('Stamp upload failed', err);
      alert(err?.message || 'Failed to upload stamp.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const settingsData = {
        company_name: companyName,
        company_address: companyAddress,
        company_trn: companyTrn,
        company_logo_url: companyLogoUrl,
        company_stamp_url: companyStampUrl,
        default_terms: defaultTerms,
        tax_rate: taxRate,
      };

      if (settingsId) {
        await supabaseHelpers.updateCompanySettings(settingsId, settingsData);
      } else {
        const newSettings = await supabaseHelpers.createCompanySettings(settingsData);
        setSettingsId(newSettings.id);
      }

      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8">
      <div className="max-w-4xl mx-auto px-6">
        <div className="mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-6">Company Settings</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Company Address</label>
              <textarea
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Tax Registration Number (TRN)</label>
              <input
                type="text"
                value={companyTrn}
                onChange={(e) => setCompanyTrn(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Company Logo</label>
              <div className="flex items-center gap-3">
                <input type="file" accept="image/*" onChange={handleLogoFileChange} />
                <div className="flex-1">
                  <input
                    type="url"
                    value={companyLogoUrl}
                    onChange={(e) => setCompanyLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              {companyLogoUrl && (
                <div className="mt-3">
                  <img src={companyLogoUrl} alt="Company Logo" className="h-16 object-contain" />
                </div>
              )}
              <p className="text-xs text-slate-500 mt-2">Upload an image or paste a direct URL</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Company Stamp (bottom-left)</label>
              <div className="flex items-center gap-3">
                <input type="file" accept="image/*" onChange={handleStampFileChange} />
                <div className="flex-1">
                  <input
                    type="url"
                    value={companyStampUrl}
                    onChange={(e) => setCompanyStampUrl(e.target.value)}
                    placeholder="https://example.com/stamp.png"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              {companyStampUrl && (
                <div className="mt-3">
                  <img src={companyStampUrl} alt="Company Stamp" className="h-16 object-contain" />
                </div>
              )}
              <p className="text-xs text-slate-500 mt-2">Upload an image or paste a direct URL</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Default Tax Rate (%)</label>
              <input
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                min="0"
                max="100"
                step="0.01"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Default Terms & Conditions
              </label>
              <textarea
                value={defaultTerms}
                onChange={(e) => setDefaultTerms(e.target.value)}
                rows={5}
                placeholder="Enter default terms and conditions that will appear on all new documents..."
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex justify-end gap-3 pt-6">
              <button
                type="button"
                onClick={onBack}
                className="px-6 py-3 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                {loading ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>

        {/* Google Calendar Integration */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarIcon className="w-5 h-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-800">Google Calendar Integration</h2>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Connect your Google account to sync live shows as calendar events. Credentials are stored server‑side.
          </p>
          <div className="flex items-center gap-3">
            <a
              href={`${import.meta.env.VITE_API_BASE_URL || ''}/api/google/oauth/start`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <LinkIcon className="w-4 h-4" />
              Connect Google Calendar
            </a>
            <span className="text-xs text-slate-500">Requires server to be running with OAuth env vars.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
