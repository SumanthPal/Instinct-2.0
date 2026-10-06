"use client";

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
 * Heavy More-filter UI (radix popover + cmdk). Loaded via next/dynamic
 * so it stays off the initial /clubs route bundle.
 */
export default function MoreCategoriesPopover({
  open,
  onOpenChange,
  moreIsActive,
  selected,
  chipClass,
  moreQuery,
  setMoreQuery,
  moreFiltered,
  onSelect,
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-filter-more
          aria-label={
            moreIsActive ? `More categories, ${selected} selected` : undefined
          }
          className={`${chipClass(moreIsActive)} inline-flex items-center gap-1`}
        >
          {moreIsActive ? selected : "More"}
          <ChevronDown className="h-3 w-3 opacity-70" aria-hidden="true" />
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
                  onSelect={() => onSelect(selected === name ? null : name)}
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
  );
}
