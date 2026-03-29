import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Trash2, FileText, Loader2, CheckCircle, XCircle, AlertCircle, WifiOff, X } from 'lucide-react';
import { documentApi, healthApi, extractErrorMessage } from '../api';
import clsx from 'clsx';

// ── Toast Notification ────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = {
    error: 'bg-rose-900/90 border-rose-700 text-rose-100',
    success: 'bg-emerald-900/90 border-emerald-700 text-emerald-100',
    warning: 'bg-amber-900/90 border-amber-700 text-amber-100',
  };

  const icons = {
    error: <XCircle className="w-4 h-4 shrink-0 mt-0.5" />,
    success: <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />,
    warning: <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />,
  };

  return (
    <div className={clsx(
      'flex items-start gap-3 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium max-w-md',
      colors[type]
    )}>
      {icons[type]}
      <span className="flex-1 leading-snug">{message}</span>
      <button onClick={onClose} className="opacity-60 hover:opacity-100 transition-opacity ml-1"><X className="w-4 h-4" /></button>
    </div>
  );
}

// ── Upload Progress Bar ───────────────────────────────────────────────────────
function ProgressBar({ progress }) {
  return (
    <div className="w-full mt-4">
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>Uploading...</span>
        <span>{progress}%</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ── Backend Status Banner ─────────────────────────────────────────────────────
function BackendOfflineBanner() {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-900/40 border border-amber-700/50 rounded-xl text-amber-300 text-xs font-medium mb-4">
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
  const [toast, setToast] = useState(null); // { message, type }

  const showToast = (message, type = 'error') => setToast({ message, type });
  const closeToast = () => setToast(null);

  // Periodically check backend health
  useEffect(() => {
    const checkHealth = async () => {
      const ok = await healthApi.check();
      setBackendOnline(ok);
    };
    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  const fetchDocuments = async () => {
    try {
      const data = await documentApi.list();
      setDocuments(data);
    } catch (error) {
      console.error('Failed to fetch documents:', extractErrorMessage(error));
    }
  };

  useEffect(() => {
    fetchDocuments();
    const interval = setInterval(fetchDocuments, 5000);
    return () => clearInterval(interval);
  }, []);

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    // Quick health check before attempting upload
    const isHealthy = await healthApi.check();
    if (!isHealthy) {
      setBackendOnline(false);
      showToast('Backend is not reachable. Please wait for it to start and try again.', 'warning');
      return;
    }
    setBackendOnline(true);

    setIsUploading(true);
    setUploadProgress(0);

    try {
      await documentApi.upload(acceptedFiles[0], (pct) => setUploadProgress(pct));
      setUploadProgress(100);
      showToast(`"${acceptedFiles[0].name}" uploaded successfully!`, 'success');
      await fetchDocuments();
    } catch (error) {
      console.error('[DocumentsPage] Upload error:', error);
      showToast(extractErrorMessage(error), 'error');
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
      showToast(`"${filename}" deleted.`, 'success');
      await fetchDocuments();
    } catch (error) {
      showToast(extractErrorMessage(error), 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col p-8 h-full bg-slate-900 text-slate-200 relative">
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50">
          <Toast message={toast.message} type={toast.type} onClose={closeToast} />
        </div>
      )}

      <h1 className="text-3xl font-bold text-slate-100 mb-6 tracking-tight">Document Library</h1>

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
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-slate-600'
            )}
          >
            <input {...getInputProps()} />
            {isUploading ? (
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
            ) : (
              <UploadCloud className={clsx('w-12 h-12 mb-4 transition-colors', isDragActive ? 'text-indigo-400' : 'text-slate-400')} />
            )}
            <p className="text-slate-200 font-medium mb-1">
              {isUploading ? 'Uploading...' : isDragActive ? 'Drop file here' : 'Drop document, or click to browse'}
            </p>
            <p className="text-slate-500 text-sm">PDF, DOCX, TXT, MD, JPG, PNG</p>
          </div>

          {/* Progress bar shown during upload */}
          {isUploading && <ProgressBar progress={uploadProgress} />}

          {/* Tips */}
          <div className="px-4 py-3 bg-slate-800/50 rounded-xl border border-slate-700/50 text-xs text-slate-500 space-y-1">
            <p className="font-semibold text-slate-400 mb-1.5">Supported formats</p>
            <p>• PDF (text + scanned/handwritten via OCR)</p>
            <p>• DOCX Word documents</p>
            <p>• TXT / Markdown files</p>
            <p>• JPG / PNG images (OCR)</p>
          </div>
        </div>

        {/* Document List */}
        <div className="flex-1 bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden flex flex-col shadow-sm min-h-0">
          <div className="px-6 py-4 border-b border-slate-700 bg-slate-800 shrink-0 flex items-center justify-between">
            <h2 className="text-lg font-medium text-slate-200">Uploaded Files</h2>
            <span className="text-xs font-medium text-slate-500 bg-slate-700/50 px-2 py-1 rounded-full">
              {documents.length} file{documents.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-600 select-none">
                <FileText className="w-12 h-12 mb-3 opacity-20" />
                <p className="font-medium text-slate-500">No documents yet</p>
                <p className="text-sm mt-1 text-slate-600">Drop a file on the left to get started</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl group transition-all border border-slate-700/50 hover:border-slate-600"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-200 truncate max-w-sm" title={doc.filename}>
                          {doc.filename}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {doc.status === 'completed' && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                          {doc.status === 'processing' && <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
                          {doc.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                          <span className={clsx(
                            'text-xs capitalize font-medium',
                            doc.status === 'completed' && 'text-emerald-400',
                            doc.status === 'processing' && 'text-blue-400',
                            doc.status === 'failed' && 'text-rose-400',
                          )}>
                            {doc.status}
                          </span>
                          {doc.status === 'failed' && (
                            <span className="text-xs text-slate-600">— retry by re-uploading</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(doc.id, doc.filename)}
                      className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0"
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
