import { useEffect, useState } from 'react';
import AuthWrapper from './components/AuthWrapper';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import DocumentForm from './components/DocumentForm';
import DocumentView from './components/DocumentView';
import Settings from './components/Settings';
import POSMode from './components/POSMode.tsx';
import Admin from './components/Admin';
import { Document as Doc, supabaseHelpers, KitchenBatch } from './lib/supabaseHelpers';
import KitchenDashboard from './components/KitchenDashboard';
import AdminKitchenDashboard from './components/AdminKitchenDashboard';
import BatchForm from './components/BatchForm';
import BatchProcessRunner from './components/BatchProcessRunner';
import BatchValidation from './components/BatchValidation';
import LiveShows from './components/LiveShows';
import LiveShowsAll from './components/LiveShowsAll';
import LiveShowDetail from './components/LiveShowDetail';
import CalendarView from './components/CalendarView';

type View = 'dashboard' | 'create' | 'edit' | 'view' | 'settings' | 'pos' | 'admin' | 'kitchen' | 'kitchen_form' | 'kitchen_run' | 'kitchen_validate' | 'kitchen_admin' | 'live_shows' | 'live_shows_all' | 'live_show_detail' | 'calendar';

function App() {
  const [currentView, setCurrentView] = useState<View>(() => {
    const saved = (typeof window !== 'undefined') ? (localStorage.getItem('app.currentView') as View | null) : null;
    return saved || 'dashboard';
  });
  const [documentType, setDocumentType] = useState<'quotation' | 'invoice' | 'delivery_note'>('invoice');
  const [selectedDocument, setSelectedDocument] = useState<Doc | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const j = localStorage.getItem('app.selectedDocument');
      return j ? (JSON.parse(j) as Doc) : null;
    } catch {
      return null;
    }
  });
  const [duplicateDocument, setDuplicateDocument] = useState<Doc | null>(null);
  const [autoPrintDocumentId, setAutoPrintDocumentId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'manager' | 'sales' | null>(null);
  const [selectedLiveShowId, setSelectedLiveShowId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const j = localStorage.getItem('app.selectedLiveShowId');
      return j || null;
    } catch {
      return null;
    }
  });
  const [selectedBatch, setSelectedBatch] = useState<KitchenBatch | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const j = localStorage.getItem('app.selectedBatch');
      return j ? (JSON.parse(j) as KitchenBatch) : null;
    } catch {
      return null;
    }
  });

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

  // Redirect sales users to POS by default and prevent dashboard access
  useEffect(() => {
    if (userRole === 'sales' && currentView === 'dashboard') {
      setCurrentView('pos');
    }
  }, [userRole, currentView]);

  // Persist current view and selections so refresh stays on the same page
  useEffect(() => {
    try {
      localStorage.setItem('app.currentView', currentView);
    } catch {}
  }, [currentView]);

  useEffect(() => {
    try {
      if (selectedDocument) {
        localStorage.setItem('app.selectedDocument', JSON.stringify(selectedDocument));
      } else {
        localStorage.removeItem('app.selectedDocument');
      }
    } catch {}
  }, [selectedDocument]);

  useEffect(() => {
    try {
      if (selectedLiveShowId) {
        localStorage.setItem('app.selectedLiveShowId', selectedLiveShowId);
      } else {
        localStorage.removeItem('app.selectedLiveShowId');
      }
    } catch {}
  }, [selectedLiveShowId]);

  useEffect(() => {
    try {
      if (selectedBatch) {
        localStorage.setItem('app.selectedBatch', JSON.stringify(selectedBatch));
      } else {
        localStorage.removeItem('app.selectedBatch');
      }
    } catch {}
  }, [selectedBatch]);

  // Guard against restoring views that require selections when none exist
  useEffect(() => {
    if (currentView === 'kitchen_run' && !selectedBatch) {
      setCurrentView('kitchen');
    }
    if ((currentView === 'view' || currentView === 'edit') && !selectedDocument) {
      setCurrentView(userRole === 'sales' ? 'pos' : 'dashboard');
    }
  }, [currentView, selectedBatch, selectedDocument, userRole]);

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
    // Sales users should not see the main dashboard; send them to POS
    setCurrentView(userRole === 'sales' ? 'pos' : 'dashboard');
    setSelectedDocument(null);
    setDuplicateDocument(null);
    setAutoPrintDocumentId(null);
    setSelectedBatch(null);
    setSelectedLiveShowId(null);
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
      <div className="min-h-screen flex">
        <Sidebar currentView={currentView} onNavigate={(v) => setCurrentView(v as View)} userRole={userRole} />
        <div className="flex-1">
      {currentView === 'dashboard' && userRole !== 'sales' && (
        <Dashboard
          onCreateDocument={handleCreateDocument}
          onViewDocument={handleViewDocument}
          onEditDocument={handleEditDocument}
          onDuplicateDocument={handleDuplicateDocument}
          onOpenSettings={() => setCurrentView('settings')}
          onOpenPOS={() => setCurrentView('pos')}
          onOpenKitchen={() => setCurrentView('kitchen')}
          onOpenKitchenAdmin={() => setCurrentView('kitchen_admin')}
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
        <POSMode onBack={handleBackToDashboard} onOrderSaved={handleDocumentSaved} onOpenKitchen={() => setCurrentView('kitchen')} />
      )}

      {currentView === 'admin' && userRole === 'admin' && (
        <Admin onBack={handleBackToDashboard} />
      )}

      {currentView === 'kitchen_admin' && (userRole === 'admin') && (
        <AdminKitchenDashboard onBack={handleBackToDashboard} />
      )}

      {currentView === 'kitchen' && (
        <KitchenDashboard
          onBack={handleBackToDashboard}
          onStartNewBatch={() => setCurrentView('kitchen_form')}
          onRunBatch={(b) => { setSelectedBatch(b); setCurrentView('kitchen_run'); }}
          onValidateBatch={(b) => { setSelectedBatch(b); setCurrentView('kitchen_validate'); }}
        />
      )}

      {currentView === 'kitchen_form' && (
        <BatchForm
          onBack={() => setCurrentView('kitchen')}
          onCreated={(b) => { setSelectedBatch(b); setCurrentView('kitchen_run'); }}
        />
      )}

      {currentView === 'kitchen_run' && selectedBatch && (
        <BatchProcessRunner
          batch={selectedBatch}
          onBack={() => setCurrentView('kitchen')}
          onFinished={(b) => { setSelectedBatch(b); setCurrentView('kitchen'); }}
        />
      )}

      {currentView === 'kitchen_validate' && selectedBatch && (userRole === 'admin' || userRole === 'manager') && (
        <BatchValidation
          batch={selectedBatch}
          onBack={() => setCurrentView('kitchen')}
          onValidated={(b) => { setSelectedBatch(b); setCurrentView('kitchen'); }}
        />
      )}
      {currentView === 'live_shows' && (
        <LiveShows onOpenDetail={(id) => { setSelectedLiveShowId(id); setCurrentView('live_show_detail'); }} />
      )}

      {currentView === 'live_shows_all' && (
        <LiveShowsAll
          onBack={handleBackToDashboard}
          onOpenDetail={(id) => { setSelectedLiveShowId(id); setCurrentView('live_show_detail'); }}
          onReceiptSaved={handleDocumentSaved}
        />
      )}

      {currentView === 'live_show_detail' && selectedLiveShowId && (
        <LiveShowDetail
          liveShowId={selectedLiveShowId}
          onBack={() => setCurrentView('live_shows_all')}
          onDeleted={() => setSelectedLiveShowId(null)}
        />
      )}

      {currentView === 'calendar' && (
        <CalendarView />
      )}
        </div>
      </div>
    </AuthWrapper>
  );
}

export default App;
