export default function ViewModeToggle({ viewMode, setViewMode }) {
    return (
      <div className="inline-flex backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 rounded-lg p-1 border border-white/20 dark:border-dark-text/10">
        <button 
          onClick={() => setViewMode('grid')}
          className={`p-2 rounded ${viewMode === 'grid' ? 'bg-lavender dark:bg-dark-gradient-start text-dark-base dark:text-dark-text-white' : 'text-dark-base dark:text-dark-text hover:bg-white/20 dark:hover:bg-dark-text/10'}`}
          aria-label="Grid view"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        </button>
        <button 
          onClick={() => setViewMode('list')}
          className={`p-2 rounded ${viewMode === 'list' ? 'bg-lavender dark:bg-dark-gradient-start text-dark-base dark:text-dark-text-white' : 'text-dark-base dark:text-dark-text hover:bg-white/20 dark:hover:bg-dark-text/10'}`}
          aria-label="List view"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
    );
  }