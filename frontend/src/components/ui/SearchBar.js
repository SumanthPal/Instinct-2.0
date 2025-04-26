import React from 'react';

export default function SearchBar({ value, onChange, onEnter }) {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      onEnter();
    }
  };

  return (
    <input
      type="text"
      placeholder="What are you looking for?"
      value={value}
      onChange={onChange}
      onKeyDown={handleKeyDown}
      className="w-full max-w-3xl px-8 py-3 text-2xl font-semibold border border-gray-300 rounded-full shadow-md text-gray-800
        focus:outline-none focus:ring-2 focus:ring-lavender
        transition-all duration-300 ease-in-out
        sm:px-10 sm:py-4 sm:text-3xl"
    />
  );
}
