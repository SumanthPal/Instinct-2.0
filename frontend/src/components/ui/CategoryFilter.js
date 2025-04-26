import React, { useState } from 'react';

export default function CategoryFilter({ categories, selectedCategories, onChange }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleCategoryChange = (event) => {
    const { value, checked } = event.target;
    if (checked) {
      onChange([...selectedCategories, value]);
    } else {
      onChange(selectedCategories.filter((category) => category !== value));
    }
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  return (
    <div className="relative mb-4 md:mb-8 w-full">
      <div className="relative inline-block text-left w-full">
        <button
          type="button"
          onClick={toggleDropdown}
          className="inline-flex justify-between items-center w-full rounded-full 
            px-4 py-2 md:px-6 md:py-3 
            bg-white/80 dark:bg-dark-profile-card/80 
            text-base md:text-lg font-semibold 
            text-gray-900 dark:text-dark-text-white 
            border border-gray-300 dark:border-gray-600
            hover:border-lavender hover:shadow-md
            transition-all duration-300 ease-in-out"
        >
          Filter by Categories
          <svg
            className={`w-4 h-4 ml-2 transform transition-transform ${
              isDropdownOpen ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isDropdownOpen && (
          <div
            className="absolute left-0 mt-2 w-full rounded-lg 
              bg-white/90 dark:bg-dark-card/90 
              shadow-lg ring-1 ring-black/5
              backdrop-blur-sm z-10 
              max-h-60 overflow-y-auto"
            onMouseLeave={() => setIsDropdownOpen(false)}
          >
            <div className="py-2" role="menu" aria-orientation="vertical">
              {categories.map((category) => (
                <label 
                  key={category}
                  className="flex items-center space-x-3 px-4 py-2 
                    hover:bg-lavender/20 dark:hover:bg-dark-gradient-start
                    text-sm md:text-base cursor-pointer
                    transition-colors duration-200"
                >
                  <input
                    type="checkbox"
                    value={category}
                    checked={selectedCategories.includes(category)}
                    onChange={handleCategoryChange}
                    className="w-4 h-4 accent-lavender 
                      focus:ring-lavender focus:ring-2
                      cursor-pointer"
                  />
                  <span className="text-gray-900 dark:text-dark-text opacity-80">
                    {category}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
