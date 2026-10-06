"use client";
import ViewModeToggle from "./ViewModeToggle";
import CategoryFilters from "./CategoryFilters";

export default function ViewControls({
  viewMode,
  setViewMode,
  selectedCategories,
  onCategoryChange,
  allCategories,
  clubs,
}) {
  return (
    <div className="mb-2">
      <div className="mb-6 flex items-center justify-center">
        <ViewModeToggle viewMode={viewMode} setViewMode={setViewMode} />
      </div>
      <CategoryFilters
        selectedCategories={selectedCategories}
        onCategoryChange={onCategoryChange}
        allCategories={allCategories}
        clubs={clubs}
      />
    </div>
  );
}
