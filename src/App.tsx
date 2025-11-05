import { useState } from 'react';
import AuthWrapper from './components/AuthWrapper';
import Dashboard from './components/Dashboard';
import DocumentForm from './components/DocumentForm';
import DocumentView from './components/DocumentView';
import Settings from './components/Settings';
import { Document as Doc } from './lib/supabaseHelpers';

type View = 'dashboard' | 'create' | 'edit' | 'view' | 'settings';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [documentType, setDocumentType] = useState<'quotation' | 'invoice' | 'delivery_note'>('invoice');
  const [selectedDocument, setSelectedDocument] = useState<Doc | null>(null);
  const [duplicateDocument, setDuplicateDocument] = useState<Doc | null>(null);

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
        />
      )}

      {currentView === 'create' && (
        <DocumentForm
          documentType={documentType}
          existingDocument={null}
          duplicateFrom={duplicateDocument}
          onBack={handleBackToDashboard}
          onSave={handleBackToDashboard}
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
          onSave={handleBackToDashboard}
        />
      )}

      {currentView === 'view' && selectedDocument && (
        <DocumentView
          document={selectedDocument}
          onBack={handleBackToDashboard}
          onEdit={() => handleEditDocument(selectedDocument)}
          onDuplicate={() => handleDuplicateDocument(selectedDocument)}
        />
      )}

      {currentView === 'settings' && <Settings onBack={handleBackToDashboard} />}
    </AuthWrapper>
  );
}

export default App;
