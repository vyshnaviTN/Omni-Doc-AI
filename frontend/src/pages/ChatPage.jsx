import { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, Sparkles, Plus, Info, ChevronRight, Square } from 'lucide-react';
import { chatApi } from '../api';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import RightPanel from '../components/RightPanel';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function ChatPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialSessionId = searchParams.get('session');

  const [messages, setMessages] = useState([
    { id: '1', role: 'ai', content: 'Hello! I am Omni-Doc. Ask me anything about your uploaded documents.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(initialSessionId || null);
  const [activeCitations, setActiveCitations] = useState(null);
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);

  useEffect(() => {
    if (initialSessionId) {
      setSessionId(initialSessionId);
      chatApi.getSessionMessages(initialSessionId).then(msgs => {
        if (msgs && msgs.length > 0) {
          setMessages(msgs.map(m => ({ id: m.id.toString(), role: m.role, content: m.content })));
        }
      }).catch(console.error);
    }
  }, [initialSessionId]);

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
    setMessages(prev => [...prev, { id: aiMsgId, role: 'ai', content: '', isStreaming: true }]);

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
      if (data.session_id && !sessionId) {
        setSessionId(data.session_id);
        navigate(`/chat?session=${data.session_id}`, { replace: true });
      }
      setMessages(prev => prev.map(msg =>
        msg.id === aiMsgId ? { ...msg, content: msg.content + data.token } : msg
      ));
    };
    const onCitations = (data) => setActiveCitations(data);
    const onError = (error) => {
      if (error.name === 'AbortError') return;
      const errorMessage = error.message || 'Error reaching the model. Please try again.';
      setMessages(prev => prev.map(msg =>
        msg.id === aiMsgId ? { ...msg, content: errorMessage, isStreaming: false } : msg
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

  return (
    <div className="flex h-full w-full bg-[#F8FAFC] text-slate-800">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-6 border-b border-slate-100 bg-white shrink-0 shadow-sm">
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
          <button
            onClick={() => {
              navigate('/chat');
              setMessages([{ id: Date.now().toString(), role: 'ai', content: 'Starting a new chat. How can I help?' }]);
              setSessionId(null);
              setActiveCitations(null);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded-lg transition-all border border-slate-200 hover:border-indigo-200"
          >
            <Plus className="w-3.5 h-3.5" />
            New Session
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          <div className="max-w-3xl mx-auto space-y-6 pb-4">
            <AnimatePresence mode="popLayout">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className={clsx('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
                >
                  {/* Avatar */}
                  <div className={clsx(
                    'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border shadow-sm',
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-indigo-500 to-purple-600 border-indigo-400 text-white'
                      : 'bg-white border-slate-200 text-indigo-500'
                  )}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  {/* Bubble */}
                  <div className={clsx('max-w-[78%] space-y-1', msg.role === 'user' ? 'items-end' : 'items-start')}>
                    <div className={clsx(
                      'px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm',
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-tr-md'
                        : 'bg-white text-slate-800 border border-slate-100 rounded-tl-md'
                    )}>
                      {msg.role === 'ai' ? (
                        <div className="prose prose-sm max-w-none leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content || (msg.isStreaming ? '' : '')}
                          </ReactMarkdown>
                          {msg.isStreaming && !msg.content && (
                            <div className="flex items-center gap-1 py-1">
                              <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                              <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                              <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="font-medium break-words whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>

                    {/* Citations */}
                    {msg.role === 'ai' && activeCitations && activeCitations.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-wrap gap-1.5 pt-1"
                      >
                        {activeCitations.map((_, cidx) => (
                          <button
                            key={cidx}
                            className="flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-md text-xs font-medium transition-colors border border-indigo-100"
                          >
                            <Info className="w-3 h-3" />
                            Source {cidx + 1}
                            <ChevronRight className="w-3 h-3 opacity-50" />
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} className="h-2" />
          </div>
        </div>

        {/* Input */}
        <div className="p-4 bg-white border-t border-slate-100 shrink-0">
          <form onSubmit={handleSend} className="max-w-3xl mx-auto">
            <div className="relative flex items-center w-full bg-white border border-slate-200 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-indigo-400 focus-within:border-indigo-300 transition-all duration-200 overflow-hidden">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about your documents..."
                className="w-full px-5 py-3.5 bg-transparent focus:outline-none text-slate-800 placeholder-slate-400 text-sm font-medium"
                disabled={isLoading}
              />
              {isLoading ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="mr-2 p-2 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-all shadow-sm"
                  title="Stop"
                >
                  <Square className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="mr-2 p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:bg-slate-200 disabled:text-slate-400 transition-all shadow-sm"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      <RightPanel activeCitations={activeCitations} onClose={() => setActiveCitations(null)} />
    </div>
  );
}
