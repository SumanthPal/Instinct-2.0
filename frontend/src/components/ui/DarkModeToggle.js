import { useEffect, useState } from 'react';
import { FaSun, FaMoon } from 'react-icons/fa';

export default function DarkModeToggle() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check if window is defined (client-side)
    if (typeof window !== 'undefined') {
      const savedDarkMode = localStorage.getItem('isDarkMode') === 'true';
      setIsDarkMode(savedDarkMode);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('isDarkMode', isDarkMode);
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <button
      onClick={toggleDarkMode}
      className="p-3 bg-transparent rounded-full hover:shadow-lg transition-all duration-300"
    >
      <div className="relative w-8 h-8">
        {/* Sun Icon */}
        <FaSun
          className={`absolute inset-0 w-8 h-8 text-yellow-500 hover:text-yellow-500 transition-opacity duration-300 ${
            isDarkMode ? 'opacity-100' : 'opacity-0'
          }`}
        />
        {/* Moon Icon */}
        <FaMoon
          className={`absolute inset-0 w-8 h-8 text-gray-900 transition-opacity duration-300 ${
            isDarkMode ? 'opacity-0' : 'opacity-100'
          }`}
        />
      </div>
    </button>
  );
}