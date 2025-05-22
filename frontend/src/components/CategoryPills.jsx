import { categoryEmojis } from './CategoryData';

export default function CategoryPills({ categories, selectedCategories, onCategoryChange, mobile = false }) {
  return (
    <>
      {categories.map((category) => {
        const isAll = category === 'All';
        const isSelected = isAll ? selectedCategories.length === 0 : selectedCategories.includes(category);
        
        return (
          <button
            key={category}
            onClick={() => onCategoryChange(isAll ? [] : [category])}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              mobile ? 'sm:px-4 sm:py-2 sm:text-sm' : 'sm:px-4 sm:py-2 sm:text-sm'
            } ${
              isSelected
                ? 'bg-lavender dark:bg-dark-gradient-start text-dark-base dark:text-dark-text-white shadow-md'
                : 'bg-white/30 dark:bg-dark-card/30 text-dark-base dark:text-dark-text hover:bg-white/50 dark:hover:bg-dark-card/50'
            }`}
          >
            <span className="mr-1">{categoryEmojis[category] || '📄'}</span>
            {mobile && category.length > 12 ? category.slice(0, 10) + '...' : 
             mobile && category === 'All Categories' ? 'All' : 
             category === 'All' ? 'All Categories' : category}
          </button>
        );
      })}
    </>
  );
}