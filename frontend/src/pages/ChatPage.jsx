import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, User, Bot, Sparkles, Plus, Square, FileText, ChevronDown, PanelRight, Paperclip, X, Upload, CheckCircle, Loader2, Pencil } from 'lucide-react';
import { chatApi, documentApi, getActiveSessionId, setActiveSessionId, extractErrorMessage } from '../api';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import RightPanel from '../components/RightPanel';
import UploadStatusPanel from '../components/UploadStatusPanel';
import PdfPreviewModal from '../components/PdfPreviewModal';
import { ToastContainer, useToast } from '../components/Toast';

// ── Thinking Indicator ───────────────────────────────────────────────────────
function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex items-center gap-1">
        <span className="thinking-dot" />
        <span className="thinking-dot" />
        <span className="thinking-dot" />
      </div>
      <span className="text-xs text-slate-400 font-medium animate-pulse">Thinking...</span>
    </div>
  );
}

// ── Inline Reference Badge ───────────────────────────────────────────────────
function ReferenceBadge({ num, onRefClick }) {
  return (
    <button
      onClick={() => onRefClick?.(num - 1)}
      className="ref-badge"
      title={`View source ${num}`}
    >
      {num}
    </button>
  );
}

// ── Custom Markdown Renderer with Reference Support ──────────────────────────
function MarkdownWithRefs({ content, onRefClick, isStreaming }) {
  if (!content) return null;

  const parts = content.split(/(\[\d+\])/g);

  return (
    <div className="prose prose-sm max-w-none leading-relaxed">
      {parts.map((part, i) => {
        const refMatch = part.match(/^\[(\d+)\]$/);
        if (refMatch) {
          const num = parseInt(refMatch[1], 10);
          return <ReferenceBadge key={i} num={num} onRefClick={onRefClick} />;
        }
        return (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>
            {part}
          </ReactMarkdown>
        );
      })}
      {isStreaming && <span className="streaming-cursor" />}
    </div>
  );
}

// ── Compact Inline Source Card ────────────────────────────────────────────────
function InlineSourceCard({ citation, index }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden transition-all hover:border-indigo-200 hover:shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
      >
        <div className="w-5 h-5 rounded-md bg-indigo-100 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-indigo-600">{index + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-slate-700 truncate block">
            📄 {citation.source || 'Unknown'}
          </span>
          <span className="text-[10px] text-slate-400">
            {citation.page != null ? `Page ${citation.page}` : ''}
            {citation.page != null && citation.chunk_index != null ? ' · ' : ''}
            {citation.chunk_index != null ? `Chunk ${citation.chunk_index}` : ''}
          </span>
        </div>
        <ChevronDown className={clsx(
          'w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0',
          expanded && 'rotate-180'
        )} />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-3 pb-3">
              <div className="text-xs text-slate-600 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-100 max-h-32 overflow-y-auto custom-scrollbar">
                {citation.content || 'No content available.'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ onUploadClick }) {
  const suggestions = [
    'What are the key findings?',
    'Summarize the main points',
    'Compare the conclusions',
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center h-full text-center px-6 select-none"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center mb-5 shadow-sm">
        <Upload className="w-7 h-7 text-indigo-400" />
      </div>
      <h2 className="text-lg font-bold text-slate-700 mb-2">Upload a document to start intelligent search</h2>
      <p className="text-sm text-slate-400 max-w-sm mb-6">
        Drop a PDF, DOCX, TXT, or image file to begin asking questions with AI-powered answers and source attribution.
      </p>
      <button
        onClick={onUploadClick}
        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-all btn-hover-lift shadow-sm"
      >
        <Upload className="w-4 h-4" />
        Upload Document
      </button>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {suggestions.map((s) => (
          <span key={s} className="px-3 py-1.5 bg-slate-100 text-slate-500 text-xs font-medium rounded-full border border-slate-200">
            {s}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

// ── Session Title Bar ────────────────────────────────────────────────────────
function SessionTitleBar({ sessionId, sessions }) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (sessions && sessionId) {
      const session = sessions.find(s => String(s.id) === String(sessionId));
      setTitle(session?.title || 'Untitled Session');
    }
  }, [sessionId, sessions]);

  const handleStartEdit = () => {
    setIsEditing(true);
    setTimeout(() => inputRef.current?.select(), 50);
  };

  const handleConfirm = async () => {
    setIsEditing(false);
    if (!title.trim() || !sessionId) return;
    try {
      await chatApi.renameSession(sessionId, title);
    } catch (err) {
      console.error("Failed to rename session", err);
      const s = sessions?.find(s => String(s.id) === String(sessionId));
      setTitle(s?.title || 'Untitled Session');
    }
  };

  if (!sessionId) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100"
    >
      <FileText className="w-3 h-3 text-slate-400" />
      {isEditing ? (
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleConfirm}
          onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
          className="session-title-input"
          autoFocus
        />
      ) : (
        <button
          onClick={handleStartEdit}
          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
        >
          <span className="truncate max-w-[160px]">Session: {title}</span>
          <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      )}
    </motion.div>
  );
}

// ── Main Chat Page ────────────────────────────────────────────────────────────
export default function ChatPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialSessionId = searchParams.get('session');
  const fallbackSessionId = getActiveSessionId();

  const [messages, setMessages] = useState([
    { id: '1', role: 'ai', content: 'Hello! I am Omni-Doc. Ask me anything about your uploaded documents.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(initialSessionId || fallbackSessionId || null);
  const [sessions, setSessions] = useState([]);

  // Sidebar state
  const [sidebarCitations, setSidebarCitations] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [highlightedSourceIndex, setHighlightedSourceIndex] = useState(null);

  // Workspace Isolation & Preview state
  const [activeUploads, setActiveUploads] = useState([]);
  const [previewDoc, setPreviewDoc] = useState(null); // {id, filename}
  const [isDragOverChat, setIsDragOverChat] = useState(false);

  // Toast
  const { toasts, addToast, dismissToast } = useToast();

  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const timeoutRef = useRef(null);

  // Smooth scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Fetch sessions list for title display
  useEffect(() => {
    chatApi.getSessions().then(setSessions).catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    const nextSessionId = initialSessionId || fallbackSessionId || null;
    setSessionId(nextSessionId);

    if (!nextSessionId) {
      setMessages([
        { id: '1', role: 'ai', content: 'Hello! I am Omni-Doc. Ask me anything about your uploaded documents.' }
      ]);
      return;
    }

    setActiveSessionId(nextSessionId);
    chatApi.getSessionMessages(nextSessionId).then(msgs => {
      if (msgs && msgs.length > 0) {
        setMessages(msgs.map(m => ({ id: m.id.toString(), role: m.role, content: m.content, citations: m.citations || [] })));
      } else {
        setMessages([
          { id: '1', role: 'ai', content: 'Hello! I am Omni-Doc. Ask me anything about your uploaded documents.' }
        ]);
      }
    }).catch(console.error);
  }, [initialSessionId, fallbackSessionId]);

  // Open sidebar with citations
  const handleOpenSidebar = useCallback((citations) => {
    setSidebarCitations(citations);
    setShowSidebar(true);
    setHighlightedSourceIndex(null);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setShowSidebar(false);
    setHighlightedSourceIndex(null);
    setTimeout(() => setSidebarCitations(null), 350);
  }, []);

  // Scroll sidebar to a specific source index
  const handleRefClick = useCallback((refIndex) => {
    const latestAiMsg = [...messages].reverse().find(m => m.role === 'ai' && m.citations?.length);
    if (latestAiMsg?.citations) {
      handleOpenSidebar(latestAiMsg.citations);
      setTimeout(() => setHighlightedSourceIndex(refIndex), 150);
    }
  }, [messages, handleOpenSidebar]);

  // ── Multi-file upload via dropzone ──────────────────────────────────────────
  const onChatDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    
    for (const file of acceptedFiles) {
      const uploadId = Math.random().toString(36).substring(7);
      const newUpload = { 
        id: uploadId, 
        filename: file.name, 
        status: 'processing', 
        progress: 0,
        onPreview: (u) => setPreviewDoc({ id: u.docId, filename: u.filename })
      };
      
      setActiveUploads(prev => [newUpload, ...prev]);

      try {
        let sid = sessionId;
        if (!sid) {
          const session = await chatApi.createSession(file.name);
          sid = session.id;
          setSessionId(sid);
          setActiveSessionId(sid);
          navigate(`/chat?session=${sid}`, { replace: true });
        }

        const result = await documentApi.upload(file, sid, (pct) => {
          setActiveUploads(prev => prev.map(u => u.id === uploadId ? { ...u, progress: pct } : u));
        });

        setActiveUploads(prev => prev.map(u => u.id === uploadId ? { 
          ...u, 
          status: 'completed', 
          docId: result.id 
        } : u));
        
        addToast(`"${file.name}" uploaded successfully!`, 'success');
      } catch (error) {
        const errMessage = extractErrorMessage(error);
        if (errMessage.toLowerCase().includes('session not found')) {
          addToast('Your session has expired or is invalid. Starting fresh.', 'warning');
          setActiveSessionId(null);
          setSessionId(null);
          navigate('/chat', { replace: true });
        } else {
          addToast(errMessage, 'error');
        }
        setActiveUploads(prev => prev.map(u => u.id === uploadId ? { ...u, status: 'failed' } : u));
      }
    }
  }, [sessionId, navigate, addToast]);

  const { getRootProps: getChatDropProps, getInputProps: getChatInputProps, open: openFileDialog } = useDropzone({
    onDrop: onChatDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt', '.md'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    multiple: true,
    noClick: true,
    noKeyboard: true,
    onDragEnter: () => setIsDragOverChat(true),
    onDragLeave: () => setIsDragOverChat(false),
    onDropAccepted: () => setIsDragOverChat(false),
    onDropRejected: () => setIsDragOverChat(false),
  });

  const handleStop = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setMessages(prev => prev.map((msg, i) => i === prev.length - 1 ? { ...msg, isStreaming: false } : msg));
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    abortControllerRef.current = new AbortController();
    const userMsg = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const aiMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: aiMsgId, role: 'ai', content: '', isStreaming: true, citations: [] }]);

    timeoutRef.current = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        setIsLoading(false);
        setMessages(prev => prev.map(msg =>
          msg.id === aiMsgId ? { ...msg, content: msg.content || 'Model taking too long. Please try again.', isStreaming: false } : msg
        ));
      }
    }, 90000);

    const onMessage = (data) => {
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      if (data.session_id && data.session_id !== sessionId) {
        setSessionId(data.session_id);
        setActiveSessionId(data.session_id);
        navigate(`/chat?session=${data.session_id}`, { replace: true });
      }
      setMessages(prev => prev.map(msg =>
        msg.id === aiMsgId ? { ...msg, content: msg.content + data.token } : msg
      ));
    };

    const onCitations = (data) => {
      setMessages(prev => prev.map(msg =>
        msg.id === aiMsgId ? { ...msg, citations: data } : msg
      ));
      if (data && data.length > 0) {
        setSidebarCitations(data);
        setShowSidebar(true);
      }
    };

    const onError = (error) => {
      if (error.name === 'AbortError') return;
      const errorMessage = extractErrorMessage(error);
      
      if (errorMessage.toLowerCase().includes('session not found')) {
        addToast('Active session not found. Resetting...', 'warning');
        setActiveSessionId(null);
        setSessionId(null);
        navigate('/chat', { replace: true });
      } else {
        addToast(errorMessage, 'error');
      }
      
      setMessages(prev => prev.map(msg =>
        msg.id === aiMsgId ? { ...msg, content: 'Sorry, I couldn\'t process your request as the session is no longer valid.', isStreaming: false } : msg
      ));
      setIsLoading(false);
    };

    const onComplete = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, isStreaming: false } : msg));
      setIsLoading(false);
      abortControllerRef.current = null;
    };

    await chatApi.askStream(userMsg.content, sessionId, onMessage, onCitations, onError, onComplete, abortControllerRef.current.signal);
  };

  const hasDocuments = messages.length > 1 || sessionId;

  return (
    <div className="flex h-full w-full bg-[#F8FAFC] text-slate-800">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div
        {...getChatDropProps()}
        className={clsx('flex-1 flex flex-col min-w-0 relative', isDragOverChat && 'chat-drop-active')}
      >
        <input {...getChatInputProps()} />

        <div className="h-14 flex items-center justify-between px-6 border-b border-slate-100 bg-white shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-indigo-50 rounded-lg">
                <Sparkles className="w-4 h-4 text-indigo-500" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-800">Neural Assistant</h1>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-slate-400 font-medium">Local model active</span>
                </div>
              </div>
            </div>
            <SessionTitleBar sessionId={sessionId} sessions={sessions} />
          </div>
          <div className="flex items-center gap-2">
            {sidebarCitations && sidebarCitations.length > 0 && !showSidebar && (
              <button
                onClick={() => setShowSidebar(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all border border-indigo-200 btn-hover-lift"
                title="Show sources panel"
              >
                <PanelRight className="w-3.5 h-3.5" />
                Sources
              </button>
            )}
            <button
              onClick={async () => {
                try {
                  const newSession = await chatApi.createSession('New Chat');
                  setSessionId(newSession.id);
                  setActiveSessionId(newSession.id);
                  navigate(`/chat?session=${newSession.id}`);
                  setMessages([{ id: Date.now().toString(), role: 'ai', content: 'Starting a new chat. How can I help?' }]);
                  handleCloseSidebar();
                } catch (error) {
                  addToast(extractErrorMessage(error), 'error');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded-lg transition-all border border-slate-200 hover:border-indigo-200 btn-hover-lift"
            >
              <Plus className="w-3.5 h-3.5" />
              New Session
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-[#FAFBFD]">
          {!hasDocuments ? (
            <EmptyState onUploadClick={openFileDialog} />
          ) : (
            <div className="max-w-3xl mx-auto space-y-5 pb-4">
              <AnimatePresence mode="popLayout">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    className={clsx('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
                  >
                    <div className={clsx(
                      'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border shadow-sm',
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-indigo-500 to-blue-600 border-indigo-400 text-white'
                        : 'bg-white border-slate-200 text-indigo-500'
                    )}>
                      {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    <div className={clsx('max-w-[78%] space-y-2', msg.role === 'user' ? 'items-end' : 'items-start')}>
                      <div className={clsx(
                        'px-4 py-3 text-sm leading-relaxed',
                        msg.role === 'user'
                          ? 'bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-2xl rounded-tr-md shadow-sm'
                          : 'ai-answer-card rounded-2xl rounded-tl-md'
                      )}>
                        {msg.role === 'ai' ? (
                          <>
                            {msg.content && !msg.isStreaming && (
                              <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-slate-100">
                                <Sparkles className="w-3 h-3 text-indigo-400" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Answer</span>
                              </div>
                            )}
                            <MarkdownWithRefs
                              content={msg.content}
                              onRefClick={handleRefClick}
                              isStreaming={msg.isStreaming && !!msg.content}
                            />
                            {msg.isStreaming && !msg.content && <ThinkingIndicator />}
                          </>
                        ) : (
                          <p className="font-medium break-words whitespace-pre-wrap">{msg.content}</p>
                        )}
                      </div>

                      {msg.role === 'ai' && msg.citations && msg.citations.length > 0 && !msg.isStreaming && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-1.5"
                        >
                          <div className="flex items-center justify-between px-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sources</p>
                            <button
                              onClick={() => handleOpenSidebar(msg.citations)}
                              className="flex items-center gap-1 text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
                            >
                              <PanelRight className="w-3 h-3" />
                              View All
                            </button>
                          </div>
                          {msg.citations.slice(0, 3).map((citation, cidx) => (
                            <InlineSourceCard key={cidx} citation={citation} index={cidx} />
                          ))}
                          {msg.citations.length > 3 && (
                            <button
                              onClick={() => handleOpenSidebar(msg.citations)}
                              className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 px-1 transition-colors"
                            >
                              +{msg.citations.length - 3} more sources
                            </button>
                          )}
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={messagesEndRef} className="h-2" />
            </div>
          )}
        </div>

        <div className="p-4 bg-white border-t border-slate-100 shrink-0">
          <form onSubmit={handleSend} className="max-w-3xl mx-auto space-y-2">
            <div className="relative flex items-center w-full bg-white border border-slate-200 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-indigo-400 focus-within:border-indigo-300 transition-all duration-200 overflow-hidden">
              <button
                type="button"
                onClick={openFileDialog}
                className="ml-2 p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all duration-200"
                title="Attach file"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about your documents..."
                className="w-full px-3 py-3.5 bg-transparent focus:outline-none text-slate-800 placeholder-slate-400 text-sm font-medium"
                disabled={isLoading}
              />
              {isLoading ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="mr-2 p-2 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-all shadow-sm btn-hover-lift"
                  title="Stop"
                >
                  <Square className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="mr-2 p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:bg-slate-200 disabled:text-slate-400 transition-all shadow-sm btn-hover-lift"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      <RightPanel
        activeCitations={showSidebar ? sidebarCitations : null}
        onClose={handleCloseSidebar}
        highlightedIndex={highlightedSourceIndex}
      />

      <UploadStatusPanel 
        uploads={activeUploads} 
        onClear={() => setActiveUploads([])} 
      />

      <PdfPreviewModal
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        docId={previewDoc?.id}
        filename={previewDoc?.filename}
      />
    </div>
  );
}
