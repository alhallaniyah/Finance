import { useState, useEffect } from 'react';
import { Document } from '../lib/supabaseHelpers';
import { supabaseHelpers } from '../lib/supabaseHelpers';
import { Search, FileText, FileSpreadsheet, Truck, Settings, Plus, Eye, CreditCard as Edit, Copy, Upload, Trash2, Filter } from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/documentHelpers';
import ExcelImport from './ExcelImport';

type DashboardProps = {
  onCreateDocument: (type: 'quotation' | 'invoice' | 'delivery_note') => void;
  onViewDocument: (document: Document) => void;
  onEditDocument: (document: Document) => void;
  onDuplicateDocument: (document: Document) => void;
  onOpenSettings: () => void;
};

export default function Dashboard({
  onCreateDocument,
  onViewDocument,
  onEditDocument,
  onDuplicateDocument,
  onOpenSettings,
}: DashboardProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    setLoading(true);
    try {
      const documents = await supabaseHelpers.getDocuments();
      setDocuments(documents);
      setSelectedDocuments(new Set()); // Clear selections when reloading
    } catch (error) {
      console.error('Error loading documents:', error);
    }
    setLoading(false);
  }

  async function handleBulkDelete() {
    if (selectedDocuments.size === 0) return;
    
    const confirmed = confirm(`Are you sure you want to delete ${selectedDocuments.size} document(s)? This action cannot be undone.`);
    if (!confirmed) return;

    setDeleting(true);
    try {
      const deletePromises = Array.from(selectedDocuments).map(id =>
        supabaseHelpers.deleteDocument(id)
      );
      await Promise.all(deletePromises);
      await loadDocuments();
    } catch (error) {
      console.error('Error deleting documents:', error);
      alert('Failed to delete some documents. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  function toggleDocumentSelection(documentId: string) {
    const newSelection = new Set(selectedDocuments);
    if (newSelection.has(documentId)) {
      newSelection.delete(documentId);
    } else {
      newSelection.add(documentId);
    }
    setSelectedDocuments(newSelection);
  }

  function toggleSelectAll() {
    if (selectedDocuments.size === filteredDocuments.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(filteredDocuments.map(doc => doc.id)));
    }
  }

  function clearFilters() {
    setSearchTerm('');
    setFilterType('all');
    setFilterStatus('all');
    setFilterDateFrom('');
    setFilterDateTo('');
  }

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      (doc.client_name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.document_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || doc.document_type === filterType;
    const matchesStatus = filterStatus === 'all' || (doc.status ?? '') === filterStatus;
    
    let matchesDateRange = true;
    if (filterDateFrom || filterDateTo) {
      const docDate = doc.issue_date ? new Date(doc.issue_date) : null;
      if (filterDateFrom && docDate) {
        matchesDateRange = matchesDateRange && docDate >= new Date(filterDateFrom);
      }
      if (filterDateTo && docDate) {
        matchesDateRange = matchesDateRange && docDate <= new Date(filterDateTo);
      }
    }
    
    return matchesSearch && matchesType && matchesStatus && matchesDateRange;
  });

  const stats = {
    quotations: documents.filter((d) => d.document_type === 'quotation').length,
    invoices: documents.filter((d) => d.document_type === 'invoice').length,
    deliveryNotes: documents.filter((d) => d.document_type === 'delivery_note').length,
    totalRevenue: documents
      .filter((d) => d.document_type === 'invoice' && d.status === 'paid')
      .reduce((sum, d) => sum + Number(d.total), 0),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto p-6">
        <header className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Document Manager</h1>
              <p className="text-slate-600 mt-1">Manage your quotations, invoices, and delivery notes</p>
            </div>
            <button
              onClick={onOpenSettings}
              className="p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-all border border-slate-200 hover:border-slate-300"
            >
              <Settings className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Quotations</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{stats.quotations}</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Invoices</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{stats.invoices}</p>
                </div>
                <div className="bg-emerald-50 p-3 rounded-lg">
                  <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Delivery Notes</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{stats.deliveryNotes}</p>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg">
                  <Truck className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Revenue</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(stats.totalRevenue)}</p>
                </div>
                <div className="bg-teal-50 p-3 rounded-lg">
                  <FileSpreadsheet className="w-6 h-6 text-teal-600" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by client name or document number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors bg-white"
            >
              <Filter className="w-5 h-5" />
              Filters
              {(filterType !== 'all' || filterStatus !== 'all' || filterDateFrom || filterDateTo) && (
                <span className="bg-blue-500 text-white text-xs rounded-full w-2 h-2"></span>
              )}
            </button>

            {selectedDocuments.size > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-5 h-5" />
                Delete ({selectedDocuments.size})
              </button>
            )}

            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-6 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-all shadow-sm"
            >
              <Upload className="w-5 h-5" />
              Import Excel
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => onCreateDocument('quotation')}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm"
              >
                <Plus className="w-5 h-5" />
                Quotation
              </button>
              <button
                onClick={() => onCreateDocument('invoice')}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-sm"
              >
                <Plus className="w-5 h-5" />
                Invoice
              </button>
              <button
                onClick={() => onCreateDocument('delivery_note')}
                className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all shadow-sm"
              >
                <Plus className="w-5 h-5" />
                Delivery Note
              </button>
            </div>
          </div>
        </header>

        {showFilters && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Filters</h3>
              <button
                onClick={clearFilters}
                className="text-sm text-slate-600 hover:text-slate-800 transition-colors"
              >
                Clear All
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Document Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="all">All Types</option>
                  <option value="quotation">Quotations</option>
                  <option value="invoice">Invoices</option>
                  <option value="delivery_note">Delivery Notes</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Date From</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Date To</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-slate-200">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-800 mb-2">No documents found</h3>
            <p className="text-slate-600 mb-6">
              {searchTerm || filterType !== 'all'
                ? 'Try adjusting your search or filter'
                : 'Create your first document to get started'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {filteredDocuments.length > 0 && (
              <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedDocuments.size === filteredDocuments.length && filteredDocuments.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-600">
                  {selectedDocuments.size > 0 
                    ? `${selectedDocuments.size} of ${filteredDocuments.length} selected`
                    : `Select all ${filteredDocuments.length} documents`
                  }
                </span>
              </div>
            )}
            
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 w-12"></th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Document
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedDocuments.has(doc.id)}
                        onChange={() => toggleDocumentSelection(doc.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            doc.document_type === 'quotation'
                              ? 'bg-blue-50'
                              : doc.document_type === 'invoice'
                              ? 'bg-emerald-50'
                              : 'bg-orange-50'
                          }`}
                        >
                          {doc.document_type === 'quotation' ? (
                            <FileText className="w-5 h-5 text-blue-600" />
                          ) : doc.document_type === 'invoice' ? (
                            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <Truck className="w-5 h-5 text-orange-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{doc.document_number}</p>
                          <p className="text-sm text-slate-500 capitalize">
                            {doc.document_type.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-800">{doc.client_name}</p>
                      <p className="text-sm text-slate-500">{doc.client_email}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{doc.issue_date ? formatDate(doc.issue_date) : '-'}</td>
                    <td className="px-6 py-4 font-semibold text-slate-800">{formatCurrency(Number(doc.total))}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          doc.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-700'
                            : doc.status === 'sent'
                            ? 'bg-blue-100 text-blue-700'
                            : doc.status === 'cancelled'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onViewDocument(doc)}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4 text-slate-600" />
                        </button>
                        <button
                          onClick={() => onEditDocument(doc)}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-slate-600" />
                        </button>
                        <button
                          onClick={() => onDuplicateDocument(doc)}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Duplicate"
                        >
                          <Copy className="w-4 h-4 text-slate-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showImport && (
        <ExcelImport
          onClose={() => setShowImport(false)}
          onImportComplete={() => {
            setShowImport(false);
            loadDocuments();
          }}
        />
      )}
    </div>
  );
}