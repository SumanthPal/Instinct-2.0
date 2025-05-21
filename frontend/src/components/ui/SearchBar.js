import React from 'react';
import { Search, X } from 'lucide-react';

export default function SearchBar({ value, onChange, onEnter, placeholder = "What are you looking for?" }) {
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
    <div className="relative w-full max-w-3xl mx-auto">
      {/* Glass Container */}
      <div className="relative backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 rounded-full border border-white/20 dark:border-dark-text/10 shadow-md overflow-hidden">
        {/* Search Icon */}
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-dark-base/70 dark:text-dark-text/70">
          <Search size={20} />
        </div>
        
        {/* Input Field */}
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent px-12 py-3 text-dark-base dark:text-dark-text
            focus:outline-none
            placeholder:text-dark-base/50 dark:placeholder:text-dark-text/50
            transition-all duration-300 ease-in-out"
        />
        
        {/* Clear Button (X) - Only show when there's text */}
        {value && (
          <button 
            onClick={handleClear}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-dark-base/70 dark:text-dark-text/70 hover:text-dark-base dark:hover:text-dark-text focus:outline-none transition-colors"
          >
            <X size={20} />
          </button>
        )}
      </div>
    </div>
  );
}