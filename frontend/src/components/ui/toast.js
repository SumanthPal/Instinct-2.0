'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  FaTimes,
  FaCheckCircle,
  FaExclamationCircle,
  FaExclamationTriangle,
  FaInfoCircle,
} from 'react-icons/fa';

const ToastContext = createContext({
  toasts: [],
  toast: () => {},
  dismiss: () => {},
});

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Set());

  // Track every pending timer so none fires after the provider unmounts.
  const schedule = (fn, ms) => {
    const handle = setTimeout(() => {
      timers.current.delete(handle);
      fn();
    }, ms);
    timers.current.add(handle);
  };

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const handle of pending) clearTimeout(handle);
      pending.clear();
    };
  }, []);

  const addToast = ({ title, description, status = 'default', duration = 5000, isClosable = true }) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { id, title, description, status, duration, isClosable, leaving: false };
    setToasts((prev) => [...prev, newToast]);
    if (duration) {
      schedule(() => dismissToast(id), duration);
    }
    return id;
  };

  const dismissToast = (id) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)),
    );
    schedule(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  };

  return (
    <ToastContext.Provider value={{ toasts, toast: addToast, dismiss: dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismissToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer = ({ toasts, dismiss }) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-3 max-w-sm sm:max-w-md">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} dismiss={dismiss} />
      ))}
    </div>
  );
};

const ToastItem = ({ toast, dismiss }) => {
  const { id, title, description, status, isClosable, leaving } = toast;
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const getStatusConfig = () => {
    switch (status) {
      case 'success':
        return {
          icon: <FaCheckCircle className="w-5 h-5 text-green-500 dark:text-green-400" />,
          gradient: 'from-green-400/20 to-green-500/30 dark:from-green-500/40 dark:to-green-400/30',
          border: 'border-green-500/30 dark:border-green-400/30',
          iconBg: 'bg-green-100 dark:bg-green-900/50',
        };
      case 'error':
        return {
          icon: <FaExclamationCircle className="w-5 h-5 text-red-500 dark:text-red-400" />,
          gradient: 'from-red-400/20 to-red-500/30 dark:from-red-500/40 dark:to-red-400/30',
          border: 'border-red-500/30 dark:border-red-400/30',
          iconBg: 'bg-red-100 dark:bg-red-900/50',
        };
      case 'warning':
        return {
          icon: <FaExclamationTriangle className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />,
          gradient: 'from-yellow-400/20 to-yellow-500/30 dark:from-yellow-500/40 dark:to-yellow-400/30',
          border: 'border-yellow-500/30 dark:border-yellow-400/30',
          iconBg: 'bg-yellow-100 dark:bg-yellow-900/50',
        };
      case 'info':
        return {
          icon: <FaInfoCircle className="w-5 h-5 text-blue-500 dark:text-blue-400" />,
          gradient: 'from-blue-400/20 to-blue-500/30 dark:from-blue-500/40 dark:to-blue-400/30',
          border: 'border-blue-500/30 dark:border-blue-400/30',
          iconBg: 'bg-blue-100 dark:bg-blue-900/50',
        };
      default:
        return {
          icon: <FaInfoCircle className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />,
          gradient: 'from-indigo-400/20 to-purple-500/30 dark:from-indigo-500/40 dark:to-purple-400/30',
          border: 'border-indigo-500/30 dark:border-indigo-400/30',
          iconBg: 'bg-indigo-100 dark:bg-indigo-900/50',
        };
    }
  };

  const config = getStatusConfig();
  const visible = entered && !leaving;

  return (
    <div
      className={`backdrop-blur-xs bg-white/70 dark:bg-dark-card/70 border ${config.border}
      bg-linear-to-r ${config.gradient} rounded-xl shadow-lg overflow-hidden flex items-start p-3
      transition-all duration-200 ease-out
      ${visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-3 scale-95'}`}
      role="alert"
    >
      <div className={`shrink-0 p-1.5 rounded-full mr-3 ${config.iconBg}`}>{config.icon}</div>

      <div className="grow min-w-0">
        <h3 className="font-semibold text-gray-800 dark:text-white truncate">{title}</h3>
        {description && (
          <p className="text-sm mt-0.5 text-gray-600 dark:text-gray-300">{description}</p>
        )}
      </div>

      {isClosable && (
        <button
          type="button"
          className="ml-2 shrink-0 p-1 rounded-full text-gray-400 hover:text-gray-600 dark:text-gray-500
          dark:hover:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors"
          onClick={() => dismiss(id)}
          aria-label="Close"
        >
          <FaTimes className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
