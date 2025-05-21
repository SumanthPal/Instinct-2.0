'use client';
import { createContext, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, AlertTriangle, InfoIcon } from 'lucide-react';

// Toast Context
const ToastContext = createContext({
  toasts: [],
  toast: () => {},
  dismiss: () => {},
});

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  
  // Add a new toast
  const addToast = ({ title, description, status = 'default', duration = 5000, isClosable = true }) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { id, title, description, status, duration, isClosable };
    
    setToasts((prev) => [...prev, newToast]);
    
    if (duration) {
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    }
    
    return id;
  };
  
  // Remove a toast
  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };
  
  return (
    <ToastContext.Provider value={{ toasts, toast: addToast, dismiss: dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismissToast} />
    </ToastContext.Provider>
  );
};

// Toast Container
const ToastContainer = ({ toasts, dismiss }) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-3 max-w-sm sm:max-w-md">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ 
              type: "spring", 
              stiffness: 400, 
              damping: 25 
            }}
          >
            <ToastItem toast={toast} dismiss={dismiss} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// Individual Toast
const ToastItem = ({ toast, dismiss }) => {
  const { id, title, description, status, isClosable } = toast;
  
  // Get the appropriate icon and styles based on status
  const getStatusConfig = () => {
    switch (status) {
      case 'success':
        return {
          icon: <CheckCircle className="w-5 h-5 text-green-500 dark:text-green-400" />,
          gradient: 'from-green-400/20 to-green-500/30 dark:from-green-500/40 dark:to-green-400/30',
          border: 'border-green-500/30 dark:border-green-400/30',
          iconBg: 'bg-green-100 dark:bg-green-900/50'
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400" />,
          gradient: 'from-red-400/20 to-red-500/30 dark:from-red-500/40 dark:to-red-400/30',
          border: 'border-red-500/30 dark:border-red-400/30',
          iconBg: 'bg-red-100 dark:bg-red-900/50'
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />,
          gradient: 'from-yellow-400/20 to-yellow-500/30 dark:from-yellow-500/40 dark:to-yellow-400/30',
          border: 'border-yellow-500/30 dark:border-yellow-400/30',
          iconBg: 'bg-yellow-100 dark:bg-yellow-900/50'
        };
      case 'info':
        return {
          icon: <InfoIcon className="w-5 h-5 text-blue-500 dark:text-blue-400" />,
          gradient: 'from-blue-400/20 to-blue-500/30 dark:from-blue-500/40 dark:to-blue-400/30',
          border: 'border-blue-500/30 dark:border-blue-400/30',
          iconBg: 'bg-blue-100 dark:bg-blue-900/50'
        };
      default:
        return {
          icon: <InfoIcon className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />,
          gradient: 'from-indigo-400/20 to-purple-500/30 dark:from-indigo-500/40 dark:to-purple-400/30',
          border: 'border-indigo-500/30 dark:border-indigo-400/30',
          iconBg: 'bg-indigo-100 dark:bg-indigo-900/50'
        };
    }
  };
  
  const config = getStatusConfig();
  
  return (
    <div
      className={`backdrop-blur-sm bg-white/70 dark:bg-dark-card/70 border ${config.border} 
      bg-gradient-to-r ${config.gradient} rounded-xl shadow-lg overflow-hidden flex items-start p-3`}
      role="alert"
    >
      <div className={`flex-shrink-0 p-1.5 rounded-full mr-3 ${config.iconBg}`}>
        {config.icon}
      </div>
      
      <div className="flex-grow min-w-0">
        <h3 className="font-semibold text-gray-800 dark:text-white truncate">{title}</h3>
        {description && <p className="text-sm mt-0.5 text-gray-600 dark:text-gray-300">{description}</p>}
      </div>
      
      {isClosable && (
        <button
          className="ml-2 flex-shrink-0 p-1 rounded-full text-gray-400 hover:text-gray-600 dark:text-gray-500 
          dark:hover:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors"
          onClick={() => dismiss(id)}
          aria-label="Close"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

// Hook for using toast
export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};