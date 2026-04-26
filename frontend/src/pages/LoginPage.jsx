import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';

export default function LoginPage() {
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [googleInitialized, setGoogleInitialized] = useState(false);

  useEffect(() => {
    // Debug log to help user fix origin_mismatch
    console.log("[Google Auth] Current Origin:", window.location.origin);
    
    // Prevent multiple initializations if script is already there
    if (window.google?.accounts?.id) {
      handleInitGoogle();
      return;
    }

    const script = document.createElement('script');
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = handleInitGoogle;
    document.body.appendChild(script);
    
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const handleInitGoogle = async () => {
    try {
      const config = await authApi.getConfig();
      const clientId = config.google_client_id;
      
      if (clientId && !window._google_initialized) {
        window.google?.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleResponse,
          ux_mode: 'popup',
          auto_select: false,
          itp_support: true
        });

        // Use the official Google Button renderer for better compatibility
        const buttonDiv = document.getElementById('google-button-div');
        if (buttonDiv) {
          window.google?.accounts.id.renderButton(buttonDiv, {
            theme: 'outline',
            size: 'large',
            shape: 'pill',
            width: 380,
            text: 'continue_with',
            logo_alignment: 'left'
          });
        }

        window._google_initialized = true;
        setGoogleInitialized(true);
      }
    } catch (err) {
      console.error("Failed to load auth config", err);
    }
  };

  const handleGoogleResponse = async (response) => {
    setLoading(true);
    setError('');
    try {
      await authApi.googleLogin(response.credential);
      navigate('/chat', { replace: true });
    } catch (err) {
      setError(err.userMessage || 'Google Login failed. Check your Console settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (tab === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (tab === 'login') {
        await authApi.login(email, password);
      } else {
        await authApi.register(email, password);
      }
      navigate('/chat', { replace: true });
    } catch (err) {
      setError(err.userMessage || err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 relative overflow-hidden">
      {/* Subtle ambient blobs */}
      <div className="absolute top-[-80px] left-[-80px] w-72 h-72 bg-indigo-100 rounded-full blur-3xl opacity-60 pointer-events-none" />
      <div className="absolute bottom-[-80px] right-[-80px] w-72 h-72 bg-purple-100 rounded-full blur-3xl opacity-60 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md px-4"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-xl shadow-indigo-200 mb-4">
            <span className="text-white font-black text-xl">OD</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Omni-Doc</h1>
          <p className="text-sm text-slate-500 mt-1">AI-powered document intelligence</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/60 p-8">
          {/* Tabs */}
          <div className="flex bg-slate-50 rounded-xl p-1 mb-7 border border-slate-100">
            {['login', 'signup'].map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); }}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  tab === t
                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-100'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-300 transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-300 transition-all"
              />
            </div>

            <AnimatePresence>
              {tab === 'signup' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-300 transition-all"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-sm font-medium"
                >
                  ⚠ {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 shadow-lg shadow-indigo-200 transition-all duration-200"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {tab === 'login' ? 'Signing in...' : 'Creating account...'}
                </span>
              ) : (
                tab === 'login' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          {/* Google Button - Using official renderer */}
          <div 
            id="google-button-div" 
            className={`mt-6 transition-opacity duration-300 ${googleInitialized && !window.electronAPI ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}
          ></div>

          {/* Electron Alternative */}
          {window.electronAPI && googleInitialized && (
            <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[11px] text-slate-500 text-center mb-3 leading-relaxed">
                Google Login is restricted in the Desktop app. Please use your email/password here, or open Omni-Doc in your browser.
              </p>
              <button
                type="button"
                onClick={() => window.electronAPI.openExternal('http://localhost:5173')}
                className="w-full py-2.5 flex items-center justify-center gap-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100 transition-all duration-200"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Launch in Browser to Login
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-5">
          Your data stays on your machine — 100% local AI.
        </p>
      </motion.div>
    </div>
  );
}
