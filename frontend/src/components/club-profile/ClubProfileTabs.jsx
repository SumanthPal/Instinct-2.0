"use client";

import { FaTh, FaCalendarAlt } from "react-icons/fa";

export default function ClubProfileTabs({ tab, onTabChange }) {
  const btn = (id, label, Icon) => (
    <button
      type="button"
      onClick={() => onTabChange(id)}
      className={`flex flex-1 items-center justify-center gap-2 py-3 text-xs font-medium uppercase tracking-wider ${
        tab === id
          ? "instinct-tab-active text-foreground"
          : "text-muted-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );

  return (
    <div className="mt-8 border-t border-border/40">
      <div className="flex">
        {btn("posts", "Posts", FaTh)}
        {btn("events", "Events", FaCalendarAlt)}
      </div>
    </div>
  );
}
