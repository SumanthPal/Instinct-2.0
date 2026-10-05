"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

const MoreCategoriesPopover = dynamic(
  () => import("@/components/MoreCategoriesPopover"),
  { ssr: false, loading: () => null },
);

/**
 * Quiet filters: All + 4 top categories + More (popover/command).
 * `allCategories` from /categories; top ranked by frequency in `clubs`.
 * More popover/cmdk is lazy-loaded on first open or idle.
 */
export default function CategoryFilters({
  selectedCategories = [],
  onCategoryChange,
  allCategories = [],
  clubs = [],
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreQuery, setMoreQuery] = useState("");
  const [moreReady, setMoreReady] = useState(false);

  useEffect(() => {
    if (moreOpen) setMoreReady(true);
  }, [moreOpen]);

  // Prefetch the chunk during idle so first open is snappy
  useEffect(() => {
    let idleId;
    let timeoutId;
    const warm = () => setMoreReady(true);
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(warm, { timeout: 2500 });
    } else {
      timeoutId = setTimeout(warm, 1500);
    }
    return () => {
      if (idleId != null && window.cancelIdleCallback) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

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
      allCategories.length ? [...allCategories] : [...counts.keys()]
    ).sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0));

    return {
      topChips: ranked.slice(0, 4),
      moreChips: ranked.slice(4),
    };
  }, [allCategories, clubs]);

  const selected = selectedCategories[0] || null;
  const moreIsActive = selected != null && moreChips.includes(selected);

  const chipClass = (active) =>
    `instinct-chip shrink-0 rounded-md border px-3 py-1.5 text-xs transition-colors ${
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
      {moreChips.length > 0 &&
        (moreReady ? (
          <MoreCategoriesPopover
            open={moreOpen}
            onOpenChange={setMoreOpen}
            moreIsActive={moreIsActive}
            selected={selected}
            chipClass={chipClass}
            moreQuery={moreQuery}
            setMoreQuery={setMoreQuery}
            moreFiltered={moreFiltered}
            onSelect={select}
          />
        ) : (
          <button
            type="button"
            data-filter-more
            className={`${chipClass(moreIsActive)} inline-flex items-center gap-1`}
            onClick={() => {
              setMoreReady(true);
              setMoreOpen(true);
            }}
          >
            {moreIsActive ? selected : "More"}
            <span className="text-[10px] opacity-70" aria-hidden>
              ▾
            </span>
          </button>
        ))}
    </div>
  );
}
