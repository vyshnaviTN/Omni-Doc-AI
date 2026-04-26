import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ChatPage from './pages/ChatPage';
import DocumentsPage from './pages/DocumentsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import LoginPage from './pages/LoginPage';
import PdfPreviewModal from './components/PdfPreviewModal';
import { useState, useEffect } from 'react';

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('omni-token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function AppLayout() {
  const [previewDoc, setPreviewDoc] = useState(null);

  useEffect(() => {
    const handlePreview = (e) => setPreviewDoc(e.detail);
    window.addEventListener('omni-preview-doc', handlePreview);
    return () => window.removeEventListener('omni-preview-doc', handlePreview);
  }, []);

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] overflow-hidden text-slate-800">
      <Sidebar className="shrink-0" />
      <main className="flex-1 flex min-w-0 overflow-hidden relative bg-[#F8FAFC]">
        <Routes>
          <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
          <Route path="/documents" element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/chat" replace />} />
        </Routes>
      </main>

      <PdfPreviewModal
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        docId={previewDoc?.id}
        filename={previewDoc?.filename}
      />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<AppLayout />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
