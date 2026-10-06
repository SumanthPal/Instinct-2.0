"use client";

import { useRef } from "react";
import { FaTh, FaCalendarAlt } from "react-icons/fa";

export const CLUB_TABS = [
  { id: "posts", label: "Posts", Icon: FaTh },
  { id: "events", label: "Events", Icon: FaCalendarAlt },
];

export const tabId = (id) => `club-tab-${id}`;
export const panelId = (id) => `club-panel-${id}`;

export default function ClubProfileTabs({ tab, onTabChange }) {
  const refs = useRef({});

  // Arrow keys move between tabs (WAI-ARIA tabs pattern, automatic activation).
  const onKeyDown = (event) => {
    const i = CLUB_TABS.findIndex((t) => t.id === tab);
    let next = null;
    if (event.key === "ArrowRight") next = (i + 1) % CLUB_TABS.length;
    else if (event.key === "ArrowLeft") next = (i - 1 + CLUB_TABS.length) % CLUB_TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = CLUB_TABS.length - 1;
    if (next == null) return;
    event.preventDefault();
    const id = CLUB_TABS[next].id;
    onTabChange(id);
    refs.current[id]?.focus();
  };

  return (
    <div className="mt-8 border-t border-border/40">
      <div role="tablist" aria-label="Club content" className="flex" onKeyDown={onKeyDown}>
        {CLUB_TABS.map(({ id, label, Icon }) => {
          const selected = tab === id;
          return (
            <button
              key={id}
              ref={(el) => {
                refs.current[id] = el;
              }}
              type="button"
              role="tab"
              id={tabId(id)}
              aria-selected={selected}
              aria-controls={panelId(id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => onTabChange(id)}
              className={`flex flex-1 items-center justify-center gap-2 py-3 text-xs font-medium uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                selected
                  ? "instinct-tab-active text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
