// src/components/ui/toast.jsx
'use client';

import { createContext, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

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
    <div className="fixed bottom-0 right-0 z-50 p-4 space-y-4 max-w-md">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
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

  // Get the appropriate styles based on status
  const getStatusStyles = () => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-500 text-green-800 dark:bg-green-900/20 dark:border-green-600 dark:text-green-200';
      case 'error':
        return 'bg-red-50 border-red-500 text-red-800 dark:bg-red-900/20 dark:border-red-600 dark:text-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-500 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-600 dark:text-yellow-200';
      case 'info':
        return 'bg-blue-50 border-blue-500 text-blue-800 dark:bg-blue-900/20 dark:border-blue-600 dark:text-blue-200';
      default:
        return 'bg-white border-gray-200 text-gray-800 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200';
    }
  };

  return (
    <div
      className={`flex items-start p-4 mb-2 rounded-lg shadow-lg border-l-4 ${getStatusStyles()}`}
      role="alert"
    >
      <div className="flex-grow">
        <h3 className="font-medium">{title}</h3>
        {description && <p className="text-sm mt-1 opacity-90">{description}</p>}
      </div>
      
      {isClosable && (
        <button
          className="ml-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          onClick={() => dismiss(id)}
          aria-label="Close"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
};

// Hook for using toast - this is the only way to use toast
export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// DO NOT export a direct toast function here - this causes hook errors
// Instead, use the useToast() hook in your components