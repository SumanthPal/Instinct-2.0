"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

/**
 * Quiet filters: All + 4 top categories + More (popover/command).
 * `allCategories` from /categories; top ranked by frequency in `clubs`.
 */
export default function CategoryFilters({
  selectedCategories = [],
  onCategoryChange,
  allCategories = [],
  clubs = [],
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreQuery, setMoreQuery] = useState("");

  const { topChips, moreChips } = useMemo(() => {
    const counts = new Map();
    for (const club of clubs) {
      for (const x of club.categories || []) {
        const name = typeof x === "string" ? x : x?.name;
        if (!name) continue;
        counts.set(name, (counts.get(name) || 0) + 1);
      }
    }
    const ranked = (
      allCategories.length
        ? [...allCategories]
        : [...counts.keys()]
    ).sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0));

    return {
      topChips: ranked.slice(0, 4),
      moreChips: ranked.slice(4),
    };
  }, [allCategories, clubs]);

  const selected = selectedCategories[0] || null;
  const moreIsActive = selected != null && moreChips.includes(selected);

  const chipClass = (active) =>
    `instinct-chip shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors ${
      active ? "instinct-chip-active" : ""
    }`;

  const select = (name) => {
    onCategoryChange(name ? [name] : []);
    setMoreOpen(false);
    setMoreQuery("");
  };

  const moreFiltered = useMemo(() => {
    const needle = moreQuery.trim().toLowerCase();
    if (!needle) return moreChips;
    return moreChips.filter((n) => n.toLowerCase().includes(needle));
  }, [moreChips, moreQuery]);

  return (
    <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => select(null)}
        className={chipClass(selected == null)}
      >
        All
      </button>
      {topChips.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => select(selected === name ? null : name)}
          className={chipClass(selected === name)}
        >
          {name}
        </button>
      ))}
      {moreChips.length > 0 && (
        <Popover open={moreOpen} onOpenChange={setMoreOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-filter-more
              className={`${chipClass(moreIsActive)} inline-flex items-center gap-1`}
            >
              {moreIsActive ? selected : "More"}
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="center">
            <Command shouldFilter={false} className="border-0 shadow-none">
              <CommandInput
                placeholder="Find category…"
                value={moreQuery}
                onValueChange={setMoreQuery}
              />
              <CommandList>
                <CommandEmpty>No categories.</CommandEmpty>
                <CommandGroup heading="More categories">
                  {moreFiltered.map((name) => (
                    <CommandItem
                      key={name}
                      value={name}
                      onSelect={() => select(selected === name ? null : name)}
                    >
                      <span className="truncate">{name}</span>
                      {selected === name && (
                        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                          active
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
