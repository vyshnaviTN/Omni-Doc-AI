import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Loader2, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function UploadStatusPanel({ uploads, onClear }) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (uploads.length === 0) return null;

  const completedCount = uploads.filter(u => u.status === 'completed').length;
  const failedCount = uploads.filter(u => u.status === 'failed').length;
  const processingCount = uploads.filter(u => u.status === 'processing').length;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80">
      <AnimatePresence>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
        >
          {/* Header */}
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Uploads ({uploads.length})
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-400"
              >
                <motion.div animate={{ rotate: isExpanded ? 0 : 180 }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </motion.div>
              </button>
              <button 
                onClick={onClear}
                className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="max-h-64 overflow-y-auto custom-scrollbar"
              >
                <div className="divide-y divide-slate-50">
                  {uploads.map((upload) => (
                    <div key={upload.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                      <div className="shrink-0">
                        {upload.status === 'processing' && <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />}
                        {upload.status === 'completed' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                        {upload.status === 'failed' && <AlertCircle className="w-4 h-4 text-rose-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-700 truncate">
                          {upload.filename}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {upload.status === 'processing' ? 'Analyzing document...' : 
                           upload.status === 'completed' ? 'Success' : 'Failed to process'}
                        </div>
                      </div>
                      {upload.status === 'completed' && upload.onPreview && (
                        <button 
                          onClick={() => upload.onPreview(upload)}
                          className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold hover:bg-indigo-100 transition-colors"
                        >
                          View
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer Stats */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] font-medium text-slate-400 uppercase tracking-widest">
            <div className="flex gap-3">
              <span className="text-emerald-500">{completedCount} Done</span>
              <span className="text-rose-500">{failedCount} Fail</span>
            </div>
            {processingCount > 0 && <span className="text-indigo-500 animate-pulse">{processingCount} Active</span>}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
