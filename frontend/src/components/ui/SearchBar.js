import React from 'react';
import { FaSearch, FaTimes } from 'react-icons/fa';

export default function SearchBar({ value, onChange, onEnter, placeholder = "What are you looking for?" }) {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      onEnter();
    }
  };

  const handleClear = () => {
    onChange({ target: { value: '' } });
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      <div className="relative backdrop-blur-xs bg-white/30 dark:bg-dark-card/30 rounded-full border border-white/20 dark:border-dark-text/10 shadow-md overflow-hidden">
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-dark-base/70 dark:text-dark-text/70">
          <FaSearch className="w-5 h-5" />
        </div>

        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent px-12 py-3 text-dark-base dark:text-dark-text
            focus:outline-hidden
            placeholder:text-dark-base/50 dark:placeholder:text-dark-text/50
            transition-all duration-300 ease-in-out"
        />

        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-dark-base/70 dark:text-dark-text/70 hover:text-dark-base dark:hover:text-dark-text focus:outline-hidden transition-colors"
            aria-label="Clear search"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
