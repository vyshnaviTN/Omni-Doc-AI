import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare, FileText, BarChart2, History, Plus, ChevronRight } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { documentApi, chatApi, getActiveSessionId, setActiveSessionId, ACTIVE_SESSION_EVENT } from '../api';
import clsx from 'clsx';

function groupSessionsByDate(sessions) {
  const groups = {
    'Today': [],
    'Yesterday': [],
    'Last 7 Days': [],
    'Earlier': []
  };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const last7DaysStart = new Date(todayStart);
  last7DaysStart.setDate(last7DaysStart.getDate() - 7);

  sessions.forEach(session => {
    const date = new Date(session.updated_at || session.created_at);
    if (date >= todayStart) groups['Today'].push(session);
    else if (date >= yesterdayStart) groups['Yesterday'].push(session);
    else if (date >= last7DaysStart) groups['Last 7 Days'].push(session);
    else groups['Earlier'].push(session);
  });

  return Object.entries(groups).filter(([_, items]) => items.length > 0);
}

export default function Sidebar() {
  const [documents, setDocuments] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const [activeSessionId, setSessionId] = useState(getActiveSessionId());
  const navigate = useNavigate();
  const location = useLocation();
  const fetchedRef = useRef(false);

  useEffect(() => {
    const refresh = async () => {
      const sessionId = getActiveSessionId();
      
      // Update local state
      setSessionId(sessionId);
      
      // Fetch recent chats first to validate the current session
      try {
        const sessions = await chatApi.getSessions();
        setRecentChats(sessions);
        
        // AUTO-RECOVERY: If we have an activeSessionId but it's not in the list, it's invalid
        if (sessionId && sessions.length > 0) {
          const isValid = sessions.some(s => String(s.id) === String(sessionId));
          if (!isValid) {
            console.warn(`[Sidebar] Session ${sessionId} not found in user sessions. Clearing...`);
            setActiveSessionId(null);
            if (location.pathname === '/chat') {
              navigate('/chat', { replace: true });
            }
          }
        }
      } catch (err) {
        console.error('[Sidebar] Failed to fetch sessions:', err);
      }

      // Fetch documents if session is valid
      if (sessionId) {
        documentApi.list(sessionId)
          .then(docs => setDocuments(docs.slice(0, 5)))
          .catch(() => setDocuments([]));
      } else {
        setDocuments([]);
      }
    };

    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener(ACTIVE_SESSION_EVENT, refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener(ACTIVE_SESSION_EVENT, refresh);
    };
  }, [location.pathname, navigate]);

  const navItems = [
    { label: 'Chat Assistant', icon: MessageSquare, path: '/chat' },
    { label: 'Document Library', icon: FileText, path: '/documents' },
    { label: 'Analytics', icon: BarChart2, path: '/analytics' },
  ];

  const email = localStorage.getItem('omni-email') || 'Local User';
  const initial = email.charAt(0).toUpperCase();

  const groupedChats = groupSessionsByDate(recentChats);

  return (
    <aside className="w-64 bg-white text-slate-700 flex flex-col border-r border-slate-100 h-screen overflow-hidden shadow-sm shrink-0">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-md shadow-indigo-200">
            <span className="text-white font-black text-xs">OD</span>
          </div>
          <span className="font-bold text-slate-800 text-lg tracking-tight">Omni-Doc</span>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-3 py-5 custom-scrollbar space-y-6">
        {/* Nav */}
        <section>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">Menu</div>
          <nav className="space-y-0.5">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-all group",
                  isActive 
                    ? "bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-50/50" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                )}
              >
                <item.icon className={clsx("w-4 h-4 transition-colors", "group-hover:text-indigo-500")} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </section>

        {/* Recent Chats (NotebookLM Style) */}
        <section>
          <div className="flex items-center justify-between px-2 mb-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">History</div>
            <History className="w-3 h-3 text-slate-300" />
          </div>
          <div className="space-y-4">
            {groupedChats.map(([groupName, sessions]) => (
              <div key={groupName} className="space-y-1">
                <div className="text-[9px] font-bold text-slate-300 uppercase tracking-widest px-3 mb-1">{groupName}</div>
                {sessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => {
                      setActiveSessionId(session.id);
                      navigate(`/chat?session=${session.id}`);
                    }}
                    className={clsx(
                      "w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-2 group",
                      String(activeSessionId) === String(session.id)
                        ? "bg-indigo-50 text-indigo-700 font-bold"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                    )}
                  >
                    <MessageSquare className="w-3 h-3 shrink-0 opacity-40 group-hover:opacity-100" />
                    <span className="truncate flex-1">{session.title || 'Untitled Chat'}</span>
                    <ChevronRight className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            ))}
            {recentChats.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-400 italic">No recent chats</div>
            )}
            <button
              onClick={() => {
                setActiveSessionId(null);
                navigate('/chat');
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all font-medium mt-2"
            >
              <Plus className="w-3.5 h-3.5" />
              Start New Chat
            </button>
          </div>
        </section>

        {/* Current Session Documents */}
        <section>
          <div className="flex items-center justify-between px-2 mb-2 pt-2 border-t border-slate-50">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sources</div>
            <FileText className="w-3 h-3 text-slate-300" />
          </div>
          <div className="space-y-0.5">
            {documents.length > 0 ? (
              documents.map(doc => (
                <div key={doc.id} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-50 transition-all cursor-default group">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 shrink-0 group-hover:bg-indigo-500 transition-colors" />
                  <span className="truncate text-xs font-medium">{doc.filename}</span>
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-slate-400 italic">
                {activeSessionId ? 'No session documents' : 'Select a session'}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* User Profile */}
      <div className="p-3 border-t border-slate-100 shrink-0 bg-slate-50/50">
        <div className="flex items-center gap-2.5 px-3 py-2 bg-white rounded-xl border border-slate-100 shadow-sm">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-slate-700 truncate">{email}</div>
            <div className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Active</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
