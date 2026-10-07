"use client";
import CategoryFilters from "./CategoryFilters";

export default function ViewControls({
  selectedCategories,
  onCategoryChange,
  allCategories,
  clubs,
}) {
  return (
    <div className="mb-8">
      <CategoryFilters
        selectedCategories={selectedCategories}
        onCategoryChange={onCategoryChange}
        allCategories={allCategories}
        clubs={clubs}
      />
    </div>
  );
}
