'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const DarkModeContext = createContext({
  isDarkMode: false,
  toggleDarkMode: () => {},
});

export const DarkModeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false); // <--- new!

  useEffect(() => {
    const saved = localStorage.getItem('isDarkMode') === 'true';
    setIsDarkMode(saved);

    if (saved) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    setMounted(true); // <--- mark as mounted after window/localStorage access
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const newMode = !prev;
      if (newMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('isDarkMode', String(newMode));
      return newMode;
    });
  };

  if (!mounted) {
    return null; // <--- Important: Don't render children until mounted!
  }

  return (
    <DarkModeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
};

export const useDarkMode = () => useContext(DarkModeContext);
