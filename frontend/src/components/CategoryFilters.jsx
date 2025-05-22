import { categoryGroups, categoriesList, getCategoryGroup } from './CategoryData';
import CategoryPills from './CategoryPills';

export default function CategoryFilters({
  selectedCategories,
  onCategoryChange,
  activeTab,
  setActiveTab,
  showCategoryDropdown,
  setShowCategoryDropdown
}) {
  const filteredCategories = activeTab === 'all' 
    ? categoriesList 
    : categoriesList.filter(category => getCategoryGroup(category) === activeTab);

  return (
    <>
      {/* Mobile Dropdown */}
      {showCategoryDropdown && (
        <div className="md:hidden mb-6 p-3 backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 rounded-lg border border-white/20 dark:border-dark-text/10 shadow-md">
          <div className="flex flex-wrap justify-start gap-2 mb-3">
            {Object.entries(categoryGroups).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-3 py-2 rounded-full text-sm font-medium transition-all ${
                  activeTab === key
                    ? 'bg-lavender dark:bg-dark-gradient-start text-dark-base dark:text-dark-text-white shadow-md'
                    : 'text-dark-base dark:text-dark-text bg-white/20 dark:bg-dark-card/20 hover:bg-white/30 dark:hover:bg-dark-text/20'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          
          <CategoryPills 
            categories={['All', ...filteredCategories]}
            selectedCategories={selectedCategories}
            onCategoryChange={onCategoryChange}
            mobile={true}
          />
        </div>
      )}

      {/* Desktop Category Tabs */}
      <div className="hidden md:inline-flex mb-8 backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 p-1 rounded-full border border-white/20 dark:border-dark-text/10 shadow-md">
        {Object.entries(categoryGroups).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 sm:px-6 py-2 sm:py-3 rounded-full text-base sm:text-lg font-medium transition-all ${
              activeTab === key
                ? 'bg-lavender dark:bg-dark-gradient-start text-dark-base dark:text-dark-text-white shadow-md'
                : 'text-dark-base dark:text-dark-text hover:bg-white/20 dark:hover:bg-dark-text/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Desktop Category Pills */}
      <div className="hidden md:flex flex-wrap justify-center gap-2 mb-8 lg:mb-12 max-w-4xl mx-auto">
        <CategoryPills 
          categories={['All', ...filteredCategories]}
          selectedCategories={selectedCategories}
          onCategoryChange={onCategoryChange}
          mobile={false}
        />
      </div>
    </>
  );
}
