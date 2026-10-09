"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { useAuth } from "@/context/auth-context";
import { fetchSmartSearch, SEARCH_DEBOUNCE_MS } from "@/lib/api";
import { eventHref, formatEventWhen, loadUpcomingEvents, searchEvents } from "@/lib/eventSearch";
import { normalizeQuery } from "@/lib/queryCache";

const BASE_PAGES = [
  { href: "/clubs", label: "Clubs" },
  { href: "/events", label: "Events" },
  { href: "/about", label: "About" },
];

// Smart search is fuzzy, so its clubs often only loosely match. Events go
// first unless a club's name or handle actually contains the query.
const clubNameHit = (clubs, term) => {
  const q = normalizeQuery(term);
  return clubs.some(
    (c) => normalizeQuery(c.name).includes(q) || normalizeQuery(c.instagram_handle).includes(q),
  );
};

/**
 * ⌘K palette: club search against /smart-search, event search over the
 * next 92 days of /events (filtered here; see lib/eventSearch), and page
 * shortcuts. Dashboard is listed first when signed in.
 * Loaded with next/dynamic from the Navbar so cmdk stays off first load.
 */
export default function CommandPalette({ open, onOpenChange }) {
  const router = useRouter();
  const { user } = useAuth();
  const pages = useMemo(
    () => (user ? [{ href: "/dashboard", label: "Dashboard" }, ...BASE_PAGES] : BASE_PAGES),
    [user],
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  // Controlled selection so Enter picks the top result once clubs arrive.
  const [selected, setSelected] = useState("");
  const requestId = useRef(0);
  const [events, setEvents] = useState(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    // Load (or reuse) the upcoming events as soon as the palette opens.
    let live = true;
    loadUpcomingEvents().then((list) => {
      if (live) setEvents(list);
    });
    return () => {
      live = false;
    };
  }, [open]);

  const eventResults = useMemo(() => (events ? searchEvents(events, query, 5) : []), [events, query]);
  const topEvent = useRef(null);
  topEvent.current = eventResults[0] || null;

  // Debounced search; a stale response never overwrites a newer one.
  useEffect(() => {
    const term = query.trim();
    if (!term) {
      requestId.current += 1;
      setResults([]);
      setSelected(`page-${pages[0].href}`);
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
      const ev = topEvent.current;
      setSelected(
        ev && !clubNameHit(found, term)
          ? `event-${ev.id}`
          : found.length
            ? `club-${found[0].instagram_handle}`
            : "search-all",
      );
      setLoading(false);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, pages]);

  const go = (href) => {
    onOpenChange(false);
    // /clubs and /events read their params once on mount; a same-route push
    // wouldn't re-seed them.
    const path = href.split("?")[0];
    if (href.includes("?") && (path === "/clubs" || path === "/events") && window.location.pathname === path) {
      window.location.assign(href);
      return;
    }
    router.push(href);
  };

  const term = query.trim();
  const eventsFirst = eventResults.length > 0 && !clubNameHit(results, term);
  // With events showing, fewer clubs so both groups fit.
  const shownClubs = eventResults.length > 0 ? results.slice(0, 4) : results;

  const clubsGroup = shownClubs.length > 0 && (
    <CommandGroup key="clubs" heading="Clubs">
      {shownClubs.map((club) => (
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
  );
  const eventsGroup = eventResults.length > 0 && (
    <CommandGroup key="events" heading="Events">
      {eventResults.map((ev) => (
        <CommandItem key={ev.id} value={`event-${ev.id}`} onSelect={() => go(eventHref(ev))}>
          <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full">
            <ClubAvatar src={ev.avatar} alt="" sizes="24px" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate">{ev.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {ev.clubName || `@${ev.handle}`}
            </span>
          </span>
          <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
            {formatEventWhen(ev.date)}
          </span>
        </CommandItem>
      ))}
    </CommandGroup>
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      label="Search Instinct"
      value={selected}
      onValueChange={setSelected}
    >
      <CommandInput
        placeholder="Search clubs, events…"
        value={query}
        onValueChange={setQuery}
        aria-label="Search clubs and events"
      />
      <CommandList className="max-h-[min(26rem,60vh)]">
        {term && !loading && events && results.length === 0 && eventResults.length === 0 && (
          <CommandEmpty>No clubs or events found.</CommandEmpty>
        )}
        {eventsFirst ? [eventsGroup, clubsGroup] : [clubsGroup, eventsGroup]}
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
            {pages.map((p) => (
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
