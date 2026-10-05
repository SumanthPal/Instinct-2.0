import { Search, X } from "lucide-react";

export default function SearchBar({
  value,
  onChange,
  onEnter,
  placeholder = "Search clubs…",
}) {
  const handleKeyDown = (event) => {
    if (event.key === "Enter") onEnter?.();
  };

  const handleClear = () => {
    onChange({ target: { value: "" } });
  };

  return (
    <div className="relative w-full">
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        aria-label="Search clubs"
        className="h-10 w-full rounded-md border border-border bg-card pl-9 pr-9 text-sm text-foreground outline-hidden transition-colors placeholder:text-muted-foreground focus-visible:border-[color:var(--accent-brand)] [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
