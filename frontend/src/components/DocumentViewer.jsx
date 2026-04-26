import { ExternalLink, ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight, FileText, Loader2, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { documentApi } from '../api';
import clsx from 'clsx';

/**
 * DocumentViewer: An integrated PDF viewer for the Inspector panel.
 * Uses native iframe viewing with blob URL for authenticated access.
 */
export default function DocumentViewer({ docId, filename, initialPage = 1, onBack }) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [blobUrl, setBlobUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let url = null;
    if (!docId) {
      setError("This citation is missing document metadata. Try re-uploading the file.");
      return;
    }

    const loadPdf = async () => {
      try {
        setIsLoading(true);
        setError(null);
        url = await documentApi.view(docId);
        setBlobUrl(url);
      } catch (err) {
        console.error("Failed to load PDF:", err);
        setError(err.userMessage || "Secure decryption failed. Please check your connection.");
      } finally {
        setIsLoading(false);
      }
    };

    loadPdf();

    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [docId]);

  // URL for the PDF with page fragment
  const pdfUrl = blobUrl ? `${blobUrl}#page=${initialPage || 1}&toolbar=0&navpanes=0` : '';

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
      {/* ToolBar */}
      <div className="h-12 flex items-center justify-between px-4 bg-slate-800/80 border-b border-slate-700/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button 
            onClick={onBack}
            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Back to sources"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
              <FileText className="w-3.5 h-3.5" />
            </div>
            <span className="text-[11px] font-bold text-slate-200 truncate">{filename}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setZoom(z => Math.max(50, z - 10))}
            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-slate-500 w-8 text-center">{zoom}%</span>
          <button 
            onClick={() => setZoom(z => Math.min(200, z + 10))}
            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-slate-700 mx-1" />
          <a 
            href={blobUrl || '#'} 
            target="_blank" 
            rel="noreferrer"
            className={clsx(
              "p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors",
              !blobUrl && "opacity-50 pointer-events-none"
            )}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Viewport */}
      <div className="flex-1 relative bg-[#333] shadow-inner overflow-hidden flex items-center justify-center">
        {error ? (
          <div className="flex flex-col items-center gap-4 px-10 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-200 mb-1">View Unavailable</p>
              <p className="text-xs text-slate-500 leading-relaxed max-w-[240px]">
                {error}
              </p>
            </div>
            <button 
              onClick={onBack}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors border border-slate-700"
            >
              Return to Sources
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <span className="text-xs text-slate-500 font-medium tracking-wide">Decrypting Document...</span>
          </div>
        ) : (
          <iframe 
            key={`${docId}-${initialPage}`} // Key change forces reload to new page anchor
            src={pdfUrl} 
            className="w-full h-full border-none"
            style={{ 
              filter: 'contrast(1.05) brightness(0.95)',
              transform: `rotate(${rotation}deg) scale(${zoom / 100})`,
              transformOrigin: 'top center'
            }}
            title="Integrated PDF Viewer"
          />
        )}
      </div>

      {/* Status Bar */}
      <div className="h-8 flex items-center justify-between px-4 bg-slate-800/40 border-t border-slate-700/50 shrink-0">
        <div className="flex items-center gap-3 text-[9px] text-slate-500 font-mono uppercase tracking-wider">
          <span>Mode: Precise Inspection</span>
          {initialPage && <span>Target: Page {initialPage}</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">Synchronized</span>
        </div>
      </div>
    </div>
  );
}
