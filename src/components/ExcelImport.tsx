import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { generateDocumentNumber } from '../lib/documentHelpers';

type ExcelImportProps = {
  onClose: () => void;
  onImportComplete: () => void;
};

type ImportRow = {
  document_type: string;
  client_name: string;
  client_email?: string;
  client_phone?: string;
  client_address?: string;
  client_trn?: string;
  issue_date: string;
  due_date?: string;
  description: string;
  sell_by?: 'unit' | 'weight';
  quantity: number;
  weight?: number;
  unit_price: number;
  discount?: number;
  notes?: string;
  status?: string;
};

export default function ExcelImport({ onClose, onImportComplete }: ExcelImportProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [error, setError] = useState<string>('');

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

      const mappedData: ImportRow[] = jsonData.map((row) => ({
        document_type: (row.document_type || row.type || 'invoice').toLowerCase(),
        client_name: row.client_name || row.client || '',
        client_email: row.client_email || row.email || '',
        client_phone: row.client_phone || row.phone || '',
        client_address: row.client_address || row.address || '',
        client_trn: row.client_trn || row.trn || '',
        issue_date: row.issue_date || row.date || new Date().toISOString().split('T')[0],
        due_date: row.due_date || '',
        description: row.description || row.item || '',
        sell_by: String(row.sell_by || '').toLowerCase() === 'weight' || Number(row.weight || row.item_weight || row.wt || 0) > 0 ? 'weight' : 'unit',
        quantity: Number(row.quantity || row.qty || 1),
        weight: Number(row.weight || row.item_weight || row.wt || 0),
        unit_price: Number(row.unit_price || row.price || 0),
        discount: Number(row.discount || 0),
        notes: row.notes || '',
        status: row.status || 'draft',
      }));

      setPreview(mappedData);
      setError('');
    } catch (err) {
      setError('Failed to read Excel file. Please check the format.');
      console.error(err);
    }
  }

  async function handleImport() {
    if (preview.length === 0) return;

    setLoading(true);
    try {
      const { data: settingsData } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      const taxRate = settingsData?.tax_rate || 0;
      const defaultTerms = settingsData?.default_terms || '';

      for (const row of preview) {
        const validType = ['quotation', 'invoice', 'delivery_note'].includes(row.document_type)
          ? row.document_type
          : 'invoice';

        const documentNumber = await generateDocumentNumber(validType as any);

        let clientId = null;
        if (row.client_name) {
          const { data: existingClient } = await supabase
            .from('clients')
            .select('id')
            .eq('name', row.client_name)
            .maybeSingle();

          if (existingClient) {
            clientId = existingClient.id;
          } else {
            const { data: newClient } = await supabase
              .from('clients')
              .insert({
                name: row.client_name,
                email: row.client_email || '',
                phone: row.client_phone || '',
                address: row.client_address || '',
                trn: row.client_trn || '',
              })
              .select()
              .single();

            clientId = newClient?.id || null;
          }
        }

        const qtyBasis = row.sell_by === 'weight' ? (row.weight ?? 0) : row.quantity;
        const amount = qtyBasis * row.unit_price;
        const subtotal = amount;
        const taxAmount = (subtotal * taxRate) / 100;
        const discount = row.discount || 0;
        const total = subtotal + taxAmount - discount;

        const { data: newDoc, error: docError } = await supabase
          .from('documents')
          .insert({
            document_type: validType,
            document_number: documentNumber,
            client_id: clientId,
            client_name: row.client_name,
            client_email: row.client_email || '',
            client_phone: row.client_phone || '',
            client_address: row.client_address || '',
            client_trn: row.client_trn || '',
            issue_date: row.issue_date,
            due_date: row.due_date || null,
            subtotal,
            tax_amount: taxAmount,
            discount_amount: discount,
            total,
            notes: row.notes || '',
            terms: defaultTerms,
            status: row.status || 'draft',
          })
          .select()
          .single();

        if (docError) throw docError;

        await supabase.from('document_items').insert({
          document_id: newDoc.id,
          description: row.description,
          sell_by: row.sell_by || 'unit',
          quantity: row.quantity,
          weight: row.weight ?? 0,
          unit_price: row.unit_price,
          amount,
        });
      }

      onImportComplete();
    } catch (err) {
      console.error('Import error:', err);
      alert('Failed to import documents. Please check the data and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-800">Import from Excel</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {preview.length === 0 ? (
            <div>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center">
                <FileSpreadsheet className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Upload Excel File</h3>
                <p className="text-slate-600 mb-6">
                  Upload an Excel file with your document data to create multiple documents at once
                </p>
                <label className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
                  <Upload className="w-5 h-5" />
                  Choose File
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-red-800">{error}</p>
                </div>
              )}

              <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-3">Excel Format Guide</h4>
                <p className="text-blue-800 text-sm mb-3">Your Excel file should have these columns:</p>
                <ul className="text-blue-800 text-sm space-y-1">
                  <li><strong>document_type</strong>: quotation, invoice, or delivery_note</li>
                  <li><strong>client_name</strong>: Client name (required)</li>
                  <li><strong>client_email</strong>: Client email</li>
                  <li><strong>client_phone</strong>: Client phone</li>
                  <li><strong>client_address</strong>: Client address</li>
                  <li><strong>client_trn</strong>: Client TRN</li>
                  <li><strong>issue_date</strong>: Issue date (YYYY-MM-DD)</li>
                  <li><strong>due_date</strong>: Due date (YYYY-MM-DD)</li>
                  <li><strong>description</strong>: Item description</li>
                  <li><strong>sell_by</strong>: unit or weight (optional; defaults to unit)</li>
                  <li><strong>quantity</strong>: Item quantity</li>
                  <li><strong>weight</strong>: Item weight (optional)</li>
                  <li><strong>unit_price</strong>: Unit price</li>
                  <li><strong>discount</strong>: Discount amount</li>
                  <li><strong>notes</strong>: Additional notes</li>
                  <li><strong>status</strong>: draft, sent, paid, or cancelled</li>
                </ul>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-emerald-800">
                  <strong>{preview.length}</strong> documents ready to import
                </p>
              </div>

              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Client</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Item</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Sell By</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Qty</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Weight</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {preview.slice(0, 10).map((row, index) => (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-700 capitalize">{row.document_type}</td>
                        <td className="px-4 py-2 text-slate-700">{row.client_name}</td>
                        <td className="px-4 py-2 text-slate-700">{row.issue_date}</td>
                        <td className="px-4 py-2 text-slate-700">{row.description}</td>
                        <td className="px-4 py-2 text-slate-700 capitalize">{row.sell_by || 'unit'}</td>
                        <td className="px-4 py-2 text-slate-700 text-right">{row.quantity}</td>
                        <td className="px-4 py-2 text-slate-700 text-right">{row.weight ?? 0}</td>
                        <td className="px-4 py-2 text-slate-700 text-right">{row.unit_price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 10 && (
                  <p className="text-center text-slate-600 text-sm mt-4">
                    ... and {preview.length - 10} more
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {preview.length > 0 && (
          <div className="flex justify-end gap-3 p-6 border-t border-slate-200">
            <button
              onClick={() => setPreview([])}
              className="px-6 py-3 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-5 h-5" />
              {loading ? 'Importing...' : `Import ${preview.length} Documents`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
