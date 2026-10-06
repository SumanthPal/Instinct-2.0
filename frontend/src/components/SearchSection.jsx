"use client";
import SearchBar from "./ui/SearchBar";

export default function SearchSection({
  searchInput,
  onSearchChange,
  onSearch,
}) {
  const handleSearch = () => {
    if (searchInput.trim() !== "") {
      onSearch();
    }
  };

  return (
    <div className="relative w-full sm:max-w-xs">
      <SearchBar
        value={searchInput}
        onChange={onSearchChange}
        onEnter={handleSearch}
        placeholder="Search clubs…"
      />
    </div>
  );
}
