import { useRef } from "react";
import { Search, X } from "lucide-react";

export default function SearchBar({
  value,
  onChange,
  onEnter,
  placeholder = "Search clubs…",
}) {
  const inputRef = useRef(null);

  const handleKeyDown = (event) => {
    if (event.key === "Enter") onEnter?.();
  };

  const handleClear = () => {
    onChange({ target: { value: "" } });
    // The clear button unmounts; keep focus in the field instead of <body>.
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full">
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        aria-label="Search clubs"
        className="h-10 w-full rounded-md border border-border bg-card pl-9 pr-9 text-sm text-foreground outline-hidden transition-colors placeholder:text-muted-foreground focus-visible:border-[color:var(--accent-brand)] focus-visible:ring-2 focus-visible:ring-ring/40 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
