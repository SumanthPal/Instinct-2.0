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
    <div className="mb-8 flex items-start justify-between gap-4">
      <CategoryFilters
        selectedCategories={selectedCategories}
        onCategoryChange={onCategoryChange}
        allCategories={allCategories}
        clubs={clubs}
      />
      <div className="shrink-0">
        <ViewModeToggle viewMode={viewMode} setViewMode={setViewMode} />
      </div>
    </div>
  );
}
