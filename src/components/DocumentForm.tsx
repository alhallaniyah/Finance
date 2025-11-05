import { useState, useEffect } from 'react';
import { Document, Client, CompanySettings } from '../lib/supabaseHelpers';
import { supabaseHelpers } from '../lib/supabaseHelpers';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { generateDocumentNumber } from '../lib/documentHelpers';

type DocumentFormProps = {
  documentType: 'quotation' | 'invoice' | 'delivery_note';
  existingDocument: Document | null;
  duplicateFrom: Document | null;
  onBack: () => void;
  onSave: () => void;
};

type FormItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
};

const allowedStatuses = ['draft', 'sent', 'paid', 'cancelled'] as const;
type Status = typeof allowedStatuses[number];

export default function DocumentForm({
  documentType,
  existingDocument,
  duplicateFrom,
  onBack,
  onSave,
}: DocumentFormProps) {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [documentNumber, setDocumentNumber] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientTrn, setClientTrn] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<FormItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [status, setStatus] = useState<Status>('draft');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [clientsData, settingsData, itemsData] = await Promise.all([
        supabaseHelpers.getClients(),
        supabaseHelpers.getCompanySettings(),
        existingDocument
          ? supabaseHelpers.getDocumentItems(existingDocument.id)
          : Promise.resolve([]),
      ]);

      setClients(clientsData);
      if (settingsData) {
        setCompanySettings(settingsData);
        setTerms(settingsData.default_terms || '');
      }

      if (existingDocument) {
        setDocumentNumber(existingDocument.document_number);
        setClientId(existingDocument.client_id || '');
        setClientName(existingDocument.client_name || '');
        setClientEmail(existingDocument.client_email || '');
        setClientPhone(existingDocument.client_phone || '');
        setClientAddress(existingDocument.client_address || '');
        setClientTrn(existingDocument.client_trn || '');
        setIssueDate(existingDocument.issue_date?.toString().split('T')[0] || new Date().toISOString().split('T')[0]);
        setDueDate(existingDocument.due_date ? new Date(existingDocument.due_date).toISOString().split('T')[0] : '');
        setDiscount(Number(existingDocument.discount_amount) || 0);
        setNotes(existingDocument.notes || '');
        setTerms(existingDocument.terms || '');
        const statusValue = existingDocument.status && allowedStatuses.includes(existingDocument.status as any)
          ? (existingDocument.status as Status)
          : 'draft';
        setStatus(statusValue);

        if (itemsData) {
          setItems(
            itemsData.map((item) => ({
              id: item.id,
              description: item.description,
              quantity: Number(item.quantity),
              unit_price: Number(item.unit_price),
              amount: Number(item.amount),
            }))
          );
        }
      } else if (duplicateFrom) {
        const newNumber = await generateDocumentNumber(documentType);
        setDocumentNumber(newNumber);
        setClientId(duplicateFrom.client_id || '');
        setClientName(duplicateFrom.client_name || '');
        setClientEmail(duplicateFrom.client_email || '');
        setClientPhone(duplicateFrom.client_phone || '');
        setClientAddress(duplicateFrom.client_address || '');
        setClientTrn(duplicateFrom.client_trn || '');
        setDiscount(Number(duplicateFrom.discount_amount) || 0);
        setNotes(duplicateFrom.notes || '');
        setTerms(duplicateFrom.terms || '');

        const dupItems = await supabaseHelpers.getDocumentItems(duplicateFrom.id);
        if (dupItems) {
          setItems(
            dupItems.map((item) => ({
              id: crypto.randomUUID(),
              description: item.description,
              quantity: Number(item.quantity),
              unit_price: Number(item.unit_price),
              amount: Number(item.amount),
            }))
          );
        }
      } else {
        const newNumber = await generateDocumentNumber(documentType);
        setDocumentNumber(newNumber);
        addItem();
      }
    } catch (error) {
      console.error('Error loading form data:', error);
    }
  }

  function handleClientSelect(selectedClientId: string) {
    setClientId(selectedClientId);
    const client = clients.find((c) => c.id === selectedClientId);
    if (client) {
      setClientName(client.name || '');
      setClientEmail(client.email || '');
      setClientPhone(client.phone || '');
      setClientAddress(client.address || '');
      setClientTrn(client.trn || '');
    }
  }

  function addItem() {
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        description: '',
        quantity: 1,
        unit_price: 0,
        amount: 0,
      },
    ]);
  }

  function removeItem(id: string) {
    setItems(items.filter((item) => item.id !== id));
  }

  function updateItem(id: string, field: keyof FormItem, value: string | number) {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === 'quantity' || field === 'unit_price') {
            updated.amount = Number(updated.quantity) * Number(updated.unit_price);
          }
          return updated;
        }
        return item;
      })
    );
  }

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = companySettings ? (subtotal * Number(companySettings.tax_rate)) / 100 : 0;
  const total = subtotal + taxAmount - discount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    console.log('Starting document save...');

    try {
      let savedClientId = clientId;

      if (!clientId && clientName) {
        const existingClient = await supabaseHelpers.getClientByName(clientName);

        if (existingClient) {
          savedClientId = existingClient.id;
        } else {
          const newClient = await supabaseHelpers.createClient({
            name: clientName,
            email: clientEmail || '',
            phone: clientPhone || '',
            address: clientAddress || '',
            trn: clientTrn || '',
          });
          savedClientId = newClient.id;
        }
      }

      const documentData = {
        document_type: documentType,
        document_number: documentNumber,
        client_id: savedClientId,
        client_name: clientName || '',
        client_email: clientEmail || '',
        client_phone: clientPhone || '',
        client_address: clientAddress || '',
        client_trn: clientTrn || '',
        issue_date: issueDate,
        due_date: dueDate || undefined,
        subtotal,
        tax_amount: taxAmount,
        discount_amount: discount,
        total,
        notes: notes || '',
        terms: terms || '',
        status: status,
      };

      console.log('Document data to save:', documentData);

      let documentId: string;

      if (existingDocument) {
        await supabaseHelpers.updateDocument(existingDocument.id, documentData);
        documentId = existingDocument.id;
        await supabaseHelpers.deleteDocumentItems(documentId);
      } else {
        const newDoc = await supabaseHelpers.createDocument(documentData);
        documentId = newDoc.id;
      }

      console.log('Document saved with ID:', documentId);

      for (const item of items) {
        await supabaseHelpers.createDocumentItem({
          document_id: documentId,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
        });
      }

      console.log('Document and items saved successfully');
      onSave();
    } catch (error) {
      console.error('Error saving document:', error);
      alert('Failed to save document. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const title = existingDocument
    ? `Edit ${documentType.replace('_', ' ')}`
    : duplicateFrom
    ? `Duplicate ${documentType.replace('_', ' ')}`
    : `New ${documentType.replace('_', ' ')}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8">
      <div className="max-w-5xl mx-auto px-6">
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
          <h1 className="text-2xl font-bold text-slate-800 mb-6 capitalize">{title}</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Document Number</label>
                <input
                  type="text"
                  value={documentNumber}
                  disabled
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Issue Date</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Client Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Select Existing Client</label>
                  <select
                    value={clientId}
                    onChange={(e) => handleClientSelect(e.target.value)}
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
                    onChange={(e) => setClientName(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">TRN</label>
                  <input
                    type="text"
                    value={clientTrn}
                    onChange={(e) => setClientTrn(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
                  <textarea
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-800">Items</h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-3 items-start bg-slate-50 p-4 rounded-lg">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-5">
                        <input
                          type="text"
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                          required
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          required
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <input
                          type="number"
                          placeholder="Price"
                          value={item.unit_price}
                          onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
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
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Terms & Conditions</label>
                    <textarea
                      value={terms}
                      onChange={(e) => setTerms(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-6 h-fit">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-slate-700">
                      <span>Subtotal:</span>
                      <span className="font-medium">{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Tax ({companySettings?.tax_rate || 0}%):</span>
                      <span className="font-medium">{taxAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-700">
                      <span>Discount:</span>
                      <input
                        type="number"
                        value={discount}
                        onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        className="w-24 px-3 py-1 border border-slate-200 rounded-lg text-right focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="border-t border-slate-300 pt-3 flex justify-between text-lg font-bold text-slate-800">
                      <span>Total:</span>
                      <span>{total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
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
                {loading ? 'Saving...' : 'Save Document'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
