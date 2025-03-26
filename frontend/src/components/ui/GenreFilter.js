// components/ui/GenreFilter.js
import React from 'react';

export default function GenreFilter({ genres, selectedGenre, onSelectGenre }) {
  return (
    <div className="mb-8 w-full">
      <select
        value={selectedGenre}
        onChange={(e) => onSelectGenre(e.target.value)}
        className="w-full p-3 border border-gray-300 rounded-lg 
          bg-white/80 dark:bg-dark-profile-card/80 
          text-gray-900 dark:text-dark-text-white 
          text-base font-medium
          focus:outline-none focus:ring-2 focus:ring-lavender
          transition-all duration-300 ease-in-out"
      >
        <option value="">All Genres</option>
        {genres.map((genre) => (
          <option key={genre} value={genre}>
            {genre}
          </option>
        ))}
      </select>
    </div>
  );
}