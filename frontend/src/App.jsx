import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ChatPage from './pages/ChatPage';
import DocumentsPage from './pages/DocumentsPage';
import AnalyticsPage from './pages/AnalyticsPage';

function AppLayout() {
  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] overflow-hidden text-slate-800">
      <Sidebar className="shrink-0" />
      <main className="flex-1 flex min-w-0 overflow-hidden relative bg-[#F8FAFC]">
        <Routes>
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/" element={<Navigate to="/chat" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<AppLayout />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
