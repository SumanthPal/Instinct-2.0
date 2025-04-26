'use client';

import { useDarkMode } from '@/context/dark-mode-context';
import { FaSun, FaMoon } from 'react-icons/fa';

export default function DarkModeToggle() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <button
      onClick={toggleDarkMode}
      className="p-3 bg-transparent rounded-full hover:shadow-lg transition-all duration-300"
    >
      <div className="relative w-8 h-8">
        <FaSun
          className={`absolute inset-0 w-8 h-8 text-yellow-500 transition-opacity duration-300 ${
            isDarkMode ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <FaMoon
          className={`absolute inset-0 w-8 h-8 text-gray-900 transition-opacity duration-300 ${
            isDarkMode ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>
    </button>
  );
}
