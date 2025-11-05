import { useEffect, useState } from 'react';
import AuthWrapper from './components/AuthWrapper';
import Dashboard from './components/Dashboard';
import DocumentForm from './components/DocumentForm';
import DocumentView from './components/DocumentView';
import Settings from './components/Settings';
import POSMode from './components/POSMode.tsx';
import Admin from './components/Admin';
import { Document as Doc, supabaseHelpers } from './lib/supabaseHelpers';

type View = 'dashboard' | 'create' | 'edit' | 'view' | 'settings' | 'pos' | 'admin';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [documentType, setDocumentType] = useState<'quotation' | 'invoice' | 'delivery_note'>('invoice');
  const [selectedDocument, setSelectedDocument] = useState<Doc | null>(null);
  const [duplicateDocument, setDuplicateDocument] = useState<Doc | null>(null);
  const [autoPrintDocumentId, setAutoPrintDocumentId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'manager' | 'sales' | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const role = await supabaseHelpers.getCurrentUserRole();
        if (mounted) setUserRole(role);
      } catch (e) {
        console.warn('Failed to load user role', e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function handleCreateDocument(type: 'quotation' | 'invoice' | 'delivery_note') {
    setDocumentType(type);
    setSelectedDocument(null);
    setDuplicateDocument(null);
    setCurrentView('create');
  }

  function handleViewDocument(document: Doc) {
    setSelectedDocument(document);
    setCurrentView('view');
  }

  function handleEditDocument(document: Doc) {
    setSelectedDocument(document);
    setDuplicateDocument(null);
    setCurrentView('edit');
  }

  function handleDuplicateDocument(document: Doc) {
    const dupType =
      document.document_type === 'quotation' ||
      document.document_type === 'invoice' ||
      document.document_type === 'delivery_note'
        ? document.document_type
        : 'invoice';
    setDocumentType(dupType);
    setSelectedDocument(null);
    setDuplicateDocument(document);
    setCurrentView('create');
  }

  function handleBackToDashboard() {
    setCurrentView('dashboard');
    setSelectedDocument(null);
    setDuplicateDocument(null);
    setAutoPrintDocumentId(null);
  }

  async function handleDocumentSaved(documentId: string, options?: { print?: boolean }) {
    if (options?.print) {
      try {
        const doc = await supabaseHelpers.getDocument(documentId);
        if (doc) {
          setSelectedDocument(doc);
          setDuplicateDocument(null);
          setCurrentView('view');
          setAutoPrintDocumentId(documentId);
          return;
        }
      } catch (error) {
        console.error('Error loading saved document for printing:', error);
      }
    }
    handleBackToDashboard();
  }

  return (
    <AuthWrapper>
      {currentView === 'dashboard' && (
        <Dashboard
          onCreateDocument={handleCreateDocument}
          onViewDocument={handleViewDocument}
          onEditDocument={handleEditDocument}
          onDuplicateDocument={handleDuplicateDocument}
          onOpenSettings={() => setCurrentView('settings')}
          onOpenPOS={() => setCurrentView('pos')}
          onOpenAdmin={() => setCurrentView('admin')}
        />
      )}

      {currentView === 'create' && (
        <DocumentForm
          documentType={documentType}
          existingDocument={null}
          duplicateFrom={duplicateDocument}
          onBack={handleBackToDashboard}
          onSave={handleDocumentSaved}
        />
      )}

      {currentView === 'edit' && selectedDocument && (
        <DocumentForm
          documentType={
            selectedDocument.document_type === 'quotation' ||
            selectedDocument.document_type === 'invoice' ||
            selectedDocument.document_type === 'delivery_note'
              ? selectedDocument.document_type
              : 'invoice'
          }
          existingDocument={selectedDocument}
          duplicateFrom={null}
          onBack={handleBackToDashboard}
          onSave={handleDocumentSaved}
        />
      )}

      {currentView === 'view' && selectedDocument && (
        <DocumentView
          document={selectedDocument}
          onBack={handleBackToDashboard}
          onEdit={() => handleEditDocument(selectedDocument)}
          onDuplicate={() => handleDuplicateDocument(selectedDocument)}
          autoPrint={selectedDocument.id === autoPrintDocumentId}
          onPrintComplete={() => setAutoPrintDocumentId(null)}
        />
      )}

      {currentView === 'settings' && <Settings onBack={handleBackToDashboard} />}

      {currentView === 'pos' && (
        <POSMode onBack={handleBackToDashboard} onOrderSaved={handleDocumentSaved} />
      )}

      {currentView === 'admin' && userRole === 'admin' && (
        <Admin onBack={handleBackToDashboard} />
      )}
    </AuthWrapper>
  );
}

export default App;
