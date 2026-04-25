import { X, Maximize2, Minimize2, ExternalLink, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

export default function PdfPreviewModal({ isOpen, onClose, docId, filename }) {
  const [isMaximized, setIsMaximized] = useState(false);

  if (!isOpen) return null;

  const pdfUrl = `http://localhost:8000/api/documents/view/${docId}`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-10">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className={`relative bg-white shadow-2xl rounded-2xl flex flex-col overflow-hidden transition-all duration-300 ${
            isMaximized ? 'w-full h-full' : 'w-full max-w-5xl h-[85vh]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500 shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-800 truncate">{filename}</h3>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Document Preview</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a 
                href={pdfUrl} 
                target="_blank" 
                rel="noreferrer"
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <button 
                onClick={() => setIsMaximized(!isMaximized)}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                title={isMaximized ? "Restore" : "Maximize"}
              >
                {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button 
                onClick={onClose}
                className="ml-2 p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* PDF Viewer Area */}
          <div className="flex-1 bg-slate-100 relative overflow-hidden">
            <iframe 
              src={`${pdfUrl}#toolbar=0`} 
              className="w-full h-full border-none shadow-inner"
              title="PDF View"
            />
          </div>

          {/* Footer Info */}
          <div className="px-6 py-3 bg-white border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-4">
              <span>Omni-Doc Secure Viewer</span>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span>Offline Encryption Active</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
