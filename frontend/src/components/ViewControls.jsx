"use client";
import ViewModeToggle from './ViewModeToggle';
import CategoryFilters from './CategoryFilters';

export default function ViewControls({
  viewMode,
  setViewMode,
  selectedCategories,
  onCategoryChange,
  activeTab,
  setActiveTab,
  showCategoryDropdown,
  setShowCategoryDropdown
}) {
  return (
    <>
      {/* Mobile: View mode + Category dropdown toggle */}
      <div className="flex flex-wrap items-center justify-between md:justify-center mb-6 gap-2">
        <ViewModeToggle viewMode={viewMode} setViewMode={setViewMode} />
        
        {/* Mobile: Category dropdown toggle */}
        <button 
          className="md:hidden inline-flex items-center gap-1 px-4 py-2 backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 rounded-lg border border-white/20 dark:border-dark-text/10 text-dark-base dark:text-dark-text"
          onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
        >
          <span>Categories</span>
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <CategoryFilters
        selectedCategories={selectedCategories}
        onCategoryChange={onCategoryChange}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        showCategoryDropdown={showCategoryDropdown}
        setShowCategoryDropdown={setShowCategoryDropdown}
      />
    </>
  );
}