import { X, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function RightPanel({ activeCitations, onClose }) {
  return (
    <AnimatePresence>
      {activeCitations && activeCitations.length > 0 && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 300, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="border-l border-slate-100 bg-white flex flex-col h-full shrink-0 shadow-sm"
        >
          {/* Header */}
          <div className="h-14 flex items-center justify-between px-5 border-b border-slate-100 shrink-0">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              Sources
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Citations */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {activeCitations.map((citation, idx) => (
              <div key={idx} className="bg-slate-50 rounded-xl p-4 border border-slate-100 hover:border-indigo-200 hover:shadow-sm transition-all">
                <div className="flex items-start gap-2.5 mb-2.5">
                  <div className="bg-indigo-50 p-1.5 rounded-lg shrink-0 mt-0.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-semibold text-slate-700 truncate" title={citation.source}>
                      {citation.source}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Page {citation.page ?? 'N/A'}</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-300 shrink-0">#{idx + 1}</span>
                </div>
                <div className="text-xs text-slate-600 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-100 max-h-40 overflow-y-auto custom-scrollbar">
                  {citation.content}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
