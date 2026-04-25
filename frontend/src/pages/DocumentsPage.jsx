import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Trash2, FileText, Loader2, CheckCircle, XCircle, AlertCircle, WifiOff } from 'lucide-react';
import { documentApi, healthApi, chatApi, extractErrorMessage, getActiveSessionId, setActiveSessionId, ACTIVE_SESSION_EVENT } from '../api';
import { ToastContainer, useToast } from '../components/Toast';
import clsx from 'clsx';

// ── Upload Progress Bar ───────────────────────────────────────────────────────
function ProgressBar({ progress }) {
  return (
    <div className="w-full mt-4">
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>Uploading...</span>
        <span>{progress}%</span>
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ── Backend Status Banner ─────────────────────────────────────────────────────
function BackendOfflineBanner() {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs font-medium mb-4">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Backend is offline or still starting. Upload will retry automatically when it becomes available.</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [backendOnline, setBackendOnline] = useState(true);
  const [activeSessionId, setCurrentSessionId] = useState(getActiveSessionId());

  const { toasts, addToast, dismissToast } = useToast();

  // Periodically check backend health
  useEffect(() => {
    const checkHealth = async () => {
      const ok = await healthApi.check();
      setBackendOnline(ok);
    };
    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => clearInterval(interval);
  }, [activeSessionId]);

  const fetchDocuments = async () => {
    try {
      if (!activeSessionId) {
        setDocuments([]);
        return;
      }
      const data = await documentApi.list(activeSessionId);
      setDocuments(data);
    } catch (error) {
      console.error('Failed to fetch documents:', extractErrorMessage(error));
    }
  };

  useEffect(() => {
    const syncSession = () => setCurrentSessionId(getActiveSessionId());
    window.addEventListener('storage', syncSession);
    window.addEventListener('focus', syncSession);
    window.addEventListener(ACTIVE_SESSION_EVENT, syncSession);
    fetchDocuments();
    const interval = setInterval(fetchDocuments, 5000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', syncSession);
      window.removeEventListener('focus', syncSession);
      window.removeEventListener(ACTIVE_SESSION_EVENT, syncSession);
    };
  }, [activeSessionId]);

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    const isHealthy = await healthApi.check();
    if (!isHealthy) {
      setBackendOnline(false);
      addToast('Backend is not reachable. Please wait for it to start and try again.', 'warning');
      return;
    }
    setBackendOnline(true);

    setIsUploading(true);
    setUploadProgress(0);

    try {
      let sessionId = activeSessionId;
      if (!sessionId) {
        const session = await chatApi.createSession(acceptedFiles[0].name);
        sessionId = session.id;
        setCurrentSessionId(sessionId);
        setActiveSessionId(sessionId);
      }

      await documentApi.upload(acceptedFiles[0], sessionId, (pct) => setUploadProgress(pct));
      setUploadProgress(100);
      addToast(`"${acceptedFiles[0].name}" uploaded successfully!`, 'success');
      await fetchDocuments();
    } catch (error) {
      console.error('[DocumentsPage] Upload error:', error);
      addToast(extractErrorMessage(error), 'error');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt', '.md'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    multiple: false,
    disabled: isUploading,
  });

  const handleDelete = async (id, filename) => {
    try {
      await documentApi.delete(id);
      addToast(`"${filename}" deleted.`, 'success');
      await fetchDocuments();
    } catch (error) {
      addToast(extractErrorMessage(error), 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col p-8 h-full bg-[#F8FAFC] text-slate-800 relative">
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <h1 className="text-3xl font-bold text-slate-800 mb-6 tracking-tight">Document Library</h1>

      {!backendOnline && <BackendOfflineBanner />}

      <div className="flex flex-col lg:flex-row gap-8 overflow-hidden flex-1">
        {/* Upload Section */}
        <div className="w-full lg:w-1/3 shrink-0 flex flex-col gap-3">
          <div
            {...getRootProps()}
            className={clsx(
              'border-2 border-dashed rounded-2xl p-10 text-center flex flex-col justify-center items-center h-64 transition-all cursor-pointer',
              isUploading && 'pointer-events-none opacity-60',
              isDragActive
                ? 'border-indigo-400 bg-indigo-50'
                : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
            )}
          >
            <input {...getInputProps()} />
            {isUploading ? (
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
            ) : (
              <UploadCloud className={clsx('w-12 h-12 mb-4 transition-colors', isDragActive ? 'text-indigo-500' : 'text-slate-300')} />
            )}
            <p className="text-slate-700 font-medium mb-1">
              {isUploading ? 'Uploading...' : isDragActive ? 'Drop file here' : 'Drop document, or click to browse'}
            </p>
            <p className="text-slate-400 text-sm">PDF, DOCX, TXT, MD, JPG, PNG</p>
          </div>

          {isUploading && <ProgressBar progress={uploadProgress} />}

          {/* Tips */}
          <div className="px-4 py-3 bg-white rounded-xl border border-slate-100 text-xs text-slate-400 space-y-1 shadow-sm">
            <p className="font-semibold text-slate-500 mb-1.5">Supported formats</p>
            <p>• PDF (text + scanned/handwritten via OCR)</p>
            <p>• DOCX Word documents</p>
            <p>• TXT / Markdown files</p>
            <p>• JPG / PNG images (OCR)</p>
          </div>
        </div>

        {/* Document List */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-100 overflow-hidden flex flex-col shadow-sm min-h-0">
          <div className="px-6 py-4 border-b border-slate-100 bg-white shrink-0 flex items-center justify-between">
            <h2 className="text-lg font-medium text-slate-800">Uploaded Files</h2>
            <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-full border border-slate-100">
              {documents.length} file{documents.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 select-none">
                <FileText className="w-12 h-12 mb-3 opacity-20" />
                <p className="font-medium text-slate-400">
                  {activeSessionId ? 'No documents in this session yet' : 'No active session selected'}
                </p>
                <p className="text-sm mt-1 text-slate-300">
                  {activeSessionId ? 'Drop a file on the left to get started' : 'Create or open a chat session first'}
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-xl group transition-all border border-slate-100 hover:border-indigo-200 hover:shadow-sm"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-700 truncate max-w-sm" title={doc.filename}>
                          {doc.filename}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {doc.status === 'completed' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                          {doc.status === 'processing' && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />}
                          {doc.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-rose-500" />}
                          <span className={clsx(
                            'text-xs capitalize font-medium',
                            doc.status === 'completed' && 'text-emerald-500',
                            doc.status === 'processing' && 'text-blue-500',
                            doc.status === 'failed' && 'text-rose-500',
                          )}>
                            {doc.status}
                          </span>
                          {doc.status === 'failed' && (
                            <span className="text-xs text-slate-400">— retry by re-uploading</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(doc.id, doc.filename)}
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      title="Delete document"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
