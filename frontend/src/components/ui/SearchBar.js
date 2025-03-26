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
      placeholder="Search clubs..."
      value={value}
      onChange={onChange}
      onKeyDown={handleKeyDown}
      className="w-full p-5 text-3xl font-semibold border border-gray-300 rounded-full shadow-md 
        focus:outline-none focus:ring-2 focus:ring-lavender
        transition-all duration-300 ease-in-out
        sm:p-6 sm:text-4xl"
    />
  );
}