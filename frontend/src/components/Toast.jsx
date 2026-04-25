import { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

const TOAST_ICONS = {
  error: XCircle,
  success: CheckCircle,
  warning: AlertCircle,
  info: Info,
};

const TOAST_COLORS = {
  error: 'bg-rose-50 border-rose-200 text-rose-700',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  info: 'bg-blue-50 border-blue-200 text-blue-700',
};

const TOAST_ICON_COLORS = {
  error: 'text-rose-500',
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
};

function ToastItem({ id, message, type = 'error', onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(id), 5000);
    return () => clearTimeout(timer);
  }, [id, onClose]);

  const Icon = TOAST_ICONS[type] || AlertCircle;

  return (
    <motion.div
      layout
      initial={{ x: 80, opacity: 0, scale: 0.95 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ x: 80, opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={clsx(
        'flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium max-w-sm backdrop-blur-sm',
        TOAST_COLORS[type]
      )}
    >
      <Icon className={clsx('w-4 h-4 shrink-0 mt-0.5', TOAST_ICON_COLORS[type])} />
      <span className="flex-1 leading-snug">{message}</span>
      <button
        onClick={() => onClose(id)}
        className="opacity-50 hover:opacity-100 transition-opacity ml-1 shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

export function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem
              id={toast.id}
              message={toast.message}
              type={toast.type}
              onClose={onDismiss}
            />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'error') => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, dismissToast };
}
