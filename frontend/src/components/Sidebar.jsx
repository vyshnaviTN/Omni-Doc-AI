import { NavLink, useNavigate } from 'react-router-dom';
import { MessageSquare, FileText, BarChart2, LogOut, History, Plus } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { documentApi, authApi, chatApi } from '../api';
import clsx from 'clsx';

export default function Sidebar() {
  const [documents, setDocuments] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const navigate = useNavigate();
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    documentApi.list().then(docs => setDocuments(docs.slice(0, 5))).catch(() => {});
    chatApi.getSessions().then(sessions => setRecentChats(sessions.slice(0, 10))).catch(() => {});
  }, []);

  const navItems = [
    { label: 'Chat Assistant', icon: MessageSquare, path: '/chat' },
    { label: 'Document Library', icon: FileText, path: '/documents' },
    { label: 'Analytics', icon: BarChart2, path: '/analytics' },
  ];

  const email = localStorage.getItem('omni-email') || 'User';
  const initial = email.charAt(0).toUpperCase();

  const handleLogout = () => {
    authApi.logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="w-64 bg-white text-slate-700 flex flex-col border-r border-slate-100 h-screen overflow-hidden shadow-sm">
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
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-100'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                )}
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={clsx('w-4 h-4', isActive ? 'text-indigo-600' : 'text-slate-400')} />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </section>

        {/* Recent Chats */}
        <section>
          <div className="flex items-center justify-between px-2 mb-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recent Chats</div>
            <History className="w-3 h-3 text-slate-300" />
          </div>
          <div className="space-y-0.5">
            {recentChats.map(chat => (
              <NavLink
                to={`/chat?session=${chat.id}`}
                key={chat.id}
                className={({ isActive }) => clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all',
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                )}
              >
                <MessageSquare className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <span className="truncate">{chat.title}</span>
              </NavLink>
            ))}
            <NavLink
              to="/chat"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-indigo-500 hover:bg-indigo-50 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              New Conversation
            </NavLink>
          </div>
        </section>

        {/* Documents */}
        <section>
          <div className="flex items-center justify-between px-2 mb-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Documents</div>
            <FileText className="w-3 h-3 text-slate-300" />
          </div>
          <div className="space-y-0.5">
            {documents.length > 0 ? (
              documents.map(doc => (
                <div key={doc.id} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-50 transition-all cursor-default">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 shrink-0" />
                  <span className="truncate">{doc.filename}</span>
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-slate-400 italic">No documents yet</div>
            )}
            <NavLink to="/documents" className="block px-3 py-2 text-xs font-semibold text-indigo-500 hover:underline">
              View All Library
            </NavLink>
          </div>
        </section>
      </div>

      {/* User Profile + Logout */}
      <div className="p-3 border-t border-slate-100 shrink-0 bg-white">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-slate-700 truncate">{email}</div>
            <div className="text-[10px] text-slate-400">Signed in</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
