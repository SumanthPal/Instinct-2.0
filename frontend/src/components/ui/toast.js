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

  // Solid left accent per variant so error/warning/success/info differ at a glance.
  const getStatusConfig = () => {
    switch (status) {
      case 'success':
        return {
          icon: <FaCheckCircle className="w-5 h-5 text-green-500 dark:text-green-400" />,
          accent: 'border-l-green-600 dark:border-l-green-400',
          iconBg: 'bg-green-100 dark:bg-green-900/50',
        };
      case 'error':
        return {
          icon: <FaExclamationCircle className="w-5 h-5 text-red-500 dark:text-red-400" />,
          accent: 'border-l-red-600 dark:border-l-red-400',
          iconBg: 'bg-red-100 dark:bg-red-900/50',
        };
      case 'warning':
        return {
          icon: <FaExclamationTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400" />,
          accent: 'border-l-amber-500 dark:border-l-amber-400',
          iconBg: 'bg-amber-100 dark:bg-amber-900/50',
        };
      case 'info':
        return {
          icon: <FaInfoCircle className="w-5 h-5 text-[color:var(--accent-blue)]" />,
          accent: 'border-l-[color:var(--accent-blue)]',
          iconBg: 'bg-blue-100 dark:bg-blue-900/50',
        };
      default:
        return {
          icon: <FaInfoCircle className="w-5 h-5 text-[color:var(--accent-brand)]" />,
          accent: 'border-l-[color:var(--accent-brand)]',
          iconBg: 'bg-muted',
        };
    }
  };

  const config = getStatusConfig();
  const visible = entered && !leaving;

  return (
    <div
      className={`border border-border border-l-4 ${config.accent} bg-card
      rounded-md shadow-sm overflow-hidden flex items-start p-3
      transition-all duration-200 ease-out motion-reduce:transition-none
      ${visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-3 scale-95'}`}
      role="alert"
    >
      <div className={`shrink-0 p-1.5 rounded-full mr-3 ${config.iconBg}`}>{config.icon}</div>

      <div className="grow min-w-0">
        <h3 className="font-semibold text-foreground truncate">{title}</h3>
        {description && <p className="text-sm mt-0.5 text-muted-foreground">{description}</p>}
      </div>

      {isClosable && (
        <button
          type="button"
          className="ml-2 shrink-0 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
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
