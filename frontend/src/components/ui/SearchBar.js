import React from 'react';
import { Search, X } from 'lucide-react';

export default function SearchBar({ value, onChange, onEnter }) {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      onEnter();
    }
  };

  const handleClear = () => {
    // Call onChange with an empty value to clear the input
    onChange({ target: { value: '' } });
  };

  return (
    <div className="relative w-full max-w-3xl">
      {/* Search Icon */}
      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
        <Search size={24} />
      </div>
      
      {/* Input Field */}
      <input
        type="text"
        placeholder="What are you looking for?"
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        className="w-full px-12 py-3 text-2xl font-semibold border border-gray-300 rounded-full shadow-md text-gray-800
          focus:outline-none focus:ring-2 focus:ring-lavender
          transition-all duration-300 ease-in-out
          sm:px-14 sm:py-4 sm:text-3xl"
      />
      
      {/* Clear Button (X) - Only show when there's text */}
      {value && (
        <button 
          onClick={handleClear}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
        >
          <X size={24} />
        </button>
      )}
    </div>
  );
}