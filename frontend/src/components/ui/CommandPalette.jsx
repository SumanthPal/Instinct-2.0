"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import ClubAvatar from "@/components/ClubAvatar";
import { fetchSmartSearch } from "@/lib/api";

const PAGES = [
  { href: "/clubs", label: "Clubs" },
  { href: "/events", label: "Events" },
  { href: "/about", label: "About" },
];

/**
 * ⌘K palette: club search against /smart-search plus page shortcuts.
 * Loaded with next/dynamic from the Navbar so cmdk stays off first load.
 */
export default function CommandPalette({ open, onOpenChange }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  // Controlled selection so Enter picks the top club once results arrive.
  const [selected, setSelected] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Debounced search; a stale response never overwrites a newer one.
  useEffect(() => {
    const term = query.trim();
    if (!term) {
      requestId.current += 1;
      setResults([]);
      setSelected("page-/clubs");
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    setSelected("search-all");
    setLoading(true);
    const timer = setTimeout(async () => {
      const { results: found } = await fetchSmartSearch(term, 1, 8);
      if (id !== requestId.current) return;
      setResults(found);
      setSelected(found.length ? `club-${found[0].instagram_handle}` : "search-all");
      setLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const go = (href) => {
    onOpenChange(false);
    // /clubs reads ?search= once on mount; a same-route push wouldn't re-seed it.
    if (href.startsWith("/clubs?") && window.location.pathname === "/clubs") {
      window.location.assign(href);
      return;
    }
    router.push(href);
  };

  const term = query.trim();

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      label="Search Instinct"
      value={selected}
      onValueChange={setSelected}
    >
      <CommandInput
        placeholder="Search clubs…"
        value={query}
        onValueChange={setQuery}
        aria-label="Search clubs"
      />
      <CommandList>
        {term && !loading && results.length === 0 && (
          <CommandEmpty>No clubs found.</CommandEmpty>
        )}
        {results.length > 0 && (
          <CommandGroup heading="Clubs">
            {results.map((club) => (
              <CommandItem
                key={club.instagram_handle}
                value={`club-${club.instagram_handle}`}
                onSelect={() => go(`/club/${encodeURIComponent(club.instagram_handle)}`)}
              >
                <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full">
                  <ClubAvatar src={club.profile_image_path} alt="" sizes="24px" />
                </span>
                <span className="truncate">{club.name}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  @{club.instagram_handle}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {term && (
          <CommandGroup heading="Search">
            <CommandItem
              value="search-all"
              onSelect={() => go(`/clubs?search=${encodeURIComponent(term)}`)}
            >
              <span className="truncate">
                Search all clubs for &ldquo;{term}&rdquo;
              </span>
            </CommandItem>
          </CommandGroup>
        )}
        {!term && (
          <CommandGroup heading="Go to">
            {PAGES.map((p) => (
              <CommandItem key={p.href} value={`page-${p.href}`} onSelect={() => go(p.href)}>
                {p.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
