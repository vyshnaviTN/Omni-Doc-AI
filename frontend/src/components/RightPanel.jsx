import { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, BookOpen, Hash, Layers, FileSearch, ArrowLeft, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import DocumentViewer from './DocumentViewer';

// ── Single Source Card ───────────────────────────────────────────────────────
function SidebarSourceCard({ citation, index, isHighlighted, onSelect, onViewDocument }) {
  const [expanded, setExpanded] = useState(false);
  const cardRef = useRef(null);

  const preview = citation.content
    ? citation.content.slice(0, 120) + (citation.content.length > 120 ? '…' : '')
    : 'Content unavailable (OCR or extraction failed)';

  const relevance = citation.relevance_score;
  const relevanceLabel =
    relevance != null
      ? relevance <= 0.4 ? 'High' : relevance <= 0.7 ? 'Medium' : 'Low'
      : null;
  const relevanceColor =
    relevance != null
      ? relevance <= 0.4
        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
        : relevance <= 0.7
          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
          : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
      : '';

  // Auto-expand and scroll when highlighted
  useEffect(() => {
    if (isHighlighted) {
      setExpanded(true);
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [isHighlighted]);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.06 }}
      className={clsx(
        'rounded-xl overflow-hidden border bg-slate-800/70 backdrop-blur-sm transition-all duration-300 group',
        isHighlighted
          ? 'border-indigo-400 ring-1 ring-indigo-400/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]'
          : 'border-slate-700/60 hover:border-indigo-500/40'
      )}
    >
      {/* Header — always visible */}
      <div
        onClick={() => onSelect?.(index)}
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-700/30 cursor-pointer"
      >
        {/* Index badge */}
        <div className={clsx(
          'w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-all duration-300',
          isHighlighted
            ? 'bg-indigo-500 border-indigo-400 shadow-lg shadow-indigo-500/20 scale-110'
            : 'bg-indigo-500/20 border-indigo-500/30'
        )}>
          <span className={clsx(
            'text-[10px] font-bold transition-colors',
            isHighlighted ? 'text-white' : 'text-indigo-400'
          )}>{index + 1}</span>
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          {/* Document name */}
          <p className="text-xs font-semibold text-slate-200 truncate leading-tight group-hover:text-white transition-colors">
            {citation.source || 'Unknown Document'}
          </p>

          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap">
            {citation.page != null && (
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                <BookOpen className="w-2.5 h-2.5" />
                Page {citation.page}
              </span>
            )}
            {relevanceLabel && (
              <span className={clsx(
                'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors',
                relevanceColor
              )}>
                {relevanceLabel}
              </span>
            )}
          </div>

          {/* Preview (when collapsed) */}
          {!expanded && (
            <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mt-0.5 group-hover:text-slate-400 transition-colors">
              {preview}
            </p>
          )}
        </div>

        <button 
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="p-1 hover:bg-slate-600 rounded-md transition-colors"
        >
          <ChevronDown className={clsx(
            'w-3.5 h-3.5 text-slate-500 transition-transform duration-200',
            expanded && 'rotate-180 text-indigo-400'
          )} />
        </button>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <div className="px-4 pb-4 space-y-3">
              <div className="text-[11px] text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-700/50 max-h-48 overflow-y-auto custom-scrollbar whitespace-pre-wrap font-sans">
                {citation.content || 'Content unavailable (OCR or extraction failed)'}
              </div>
              <button
                onClick={() => onViewDocument(citation)}
                className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all shadow-sm active:scale-[0.98]"
              >
                <FileSearch className="w-3.5 h-3.5" />
                Inspect Document
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Sources Sidebar Panel ────────────────────────────────────────────────────
export default function RightPanel({ activeCitations, onClose, highlightedIndex }) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'document'
  const [inspectCitation, setInspectCitation] = useState(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const scrollRef = useRef(null);

  // Sync highlighted index from parent (when [1] badge is clicked)
  useEffect(() => {
    if (highlightedIndex != null) {
      setSelectedIndex(highlightedIndex);
      setViewMode('list'); // Switch to list to show the highlighted card
    }
  }, [highlightedIndex]);

  // Reset when citations change
  useEffect(() => {
    setSelectedIndex(null);
    setViewMode('list');
    setInspectCitation(null);
  }, [activeCitations]);

  const handleViewDocument = (citation) => {
    setInspectCitation(citation);
    setViewMode('document');
  };

  return (
    <AnimatePresence>
      {activeCitations && activeCitations.length > 0 && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ 
            width: isMaximized ? '60%' : 400, 
            opacity: 1 
          }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="border-l border-slate-700/50 source-panel-bg flex flex-col h-full shrink-0 overflow-hidden relative z-40 shadow-2xl"
        >
          {viewMode === 'list' ? (
            <>
              {/* Header */}
              <div className="h-14 flex items-center justify-between px-5 border-b border-slate-700/50 bg-slate-800/60 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-indigo-500/15 rounded-lg border border-indigo-500/20">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-slate-200 tracking-wide uppercase">Source Inspector</h2>
                    <p className="text-[10px] text-slate-500 font-medium">{activeCitations.length} reference{activeCitations.length !== 1 ? 's' : ''} cited</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsMaximized(!isMaximized)}
                    className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-700/60 rounded-lg transition-all"
                    title={isMaximized ? "Minimize" : "Maximize Inspector"}
                  >
                    {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={onClose}
                    className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-700/60 rounded-lg transition-all"
                    aria-label="Close panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Source cards */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-900/20">
                {activeCitations.map((citation, idx) => (
                  <SidebarSourceCard
                    key={idx}
                    citation={citation}
                    index={idx}
                    isHighlighted={selectedIndex === idx}
                    onSelect={setSelectedIndex}
                    onViewDocument={handleViewDocument}
                  />
                ))}
              </div>

              {/* Footer hint */}
              <div className="px-5 py-3 border-t border-slate-700/50 bg-slate-800/40 shrink-0">
                <p className="text-[10px] text-slate-600 text-center font-medium italic">
                  Select a source to inspect context or click "Inspect Document" for full view
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 bg-slate-900">
              <DocumentViewer 
                docId={inspectCitation.doc_id || inspectCitation.source} // Backend now supports filename lookup fallback
                filename={inspectCitation.source}
                initialPage={inspectCitation.page}
                onBack={() => setViewMode('list')}
              />
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

