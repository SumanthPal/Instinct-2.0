"use client";

import Calendar from "react-calendar";
import { FaDownload, FaGlobe, FaLink, FaExternalLinkAlt } from "react-icons/fa";
import { format } from "date-fns";
import {
  formatDate,
  getItemsForDate,
  hasItemsOnDate,
} from "./clubDetailUtils";
import "../../../styles/CalendarStyles.css";

export default function ClubEventsPanel({
  clubData,
  clubEvents,
  clubPosts,
  selectedDate,
  onDateChange,
  calendarUrl,
}) {
  const tileContent = ({ date, view }) => {
    if (view !== "month") return null;
    const hasPost = hasItemsOnDate(clubPosts, date, "post");
    const hasEvent = hasItemsOnDate(clubEvents, date, "event");
    if (hasPost && hasEvent) {
      return (
        <div className="mt-0.5 flex justify-center gap-0.5">
          <div className="h-1.5 w-1.5 rounded-full bg-sky-500 sm:h-2 sm:w-2" />
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 sm:h-2 sm:w-2" />
        </div>
      );
    }
    if (hasPost) {
      return (
        <div className="mx-auto mt-0.5 h-1.5 w-1.5 rounded-full bg-sky-500 sm:mt-1 sm:h-2 sm:w-2" />
      );
    }
    if (hasEvent) {
      return (
        <div className="mx-auto mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 sm:mt-1 sm:h-2 sm:w-2" />
      );
    }
    return null;
  };

  const postsForDate = getItemsForDate(clubPosts, selectedDate, "post");
  const eventsForDate = getItemsForDate(clubEvents, selectedDate, "event");
  const links = Array.isArray(clubData?.club_links) ? clubData.club_links : [];

  return (
    <div className="space-y-6 px-4 py-6 sm:px-0">
      {clubEvents.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">No events.</p>
      ) : (
        <ul className="divide-y divide-border/40">
          {clubEvents.slice(0, 40).map((ev, i) => (
            <li key={ev.id || ev.name || i} className="py-4 text-left">
              <p className="text-sm font-medium text-foreground">
                {ev.name || ev.parsed?.Name || "Event"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {ev.date
                  ? new Date(ev.date).toLocaleString()
                  : ev.parsed?.Date
                    ? new Date(ev.parsed.Date).toLocaleString()
                    : ""}
              </p>
            </li>
          ))}
        </ul>
      )}

      {links.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 text-left">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Links</h3>
          <div className="space-y-2">
            {links.map((linkData, index) => (
              <a
                key={index}
                href={linkData.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[44px] items-center gap-3 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                <FaLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate font-medium">
                  {linkData.text?.length > 40
                    ? `${linkData.text.substring(0, 40)}...`
                    : linkData.text}
                </span>
                <FaExternalLinkAlt className="h-3 w-3 shrink-0 text-muted-foreground" />
              </a>
            ))}
          </div>
        </div>
      )}

      {calendarUrl && (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center">
          <h4 className="mb-1 text-sm font-semibold text-foreground">
            Never miss an event
          </h4>
          <p className="mb-4 text-xs text-muted-foreground">
            Add {clubData?.name}&apos;s events to your calendar
          </p>
          <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => window.open(calendarUrl)}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              <FaDownload className="h-4 w-4" />
              Download Calendar
            </button>
            <button
              type="button"
              onClick={() =>
                window.open(calendarUrl.replace("https", "webcal"))
              }
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              <FaGlobe className="h-4 w-4" />
              Subscribe
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-3 shadow-sm calendar-responsive">
        <h3 className="mb-3 text-left text-sm font-semibold text-foreground">
          Activity calendar
        </h3>
        <div className="mb-3 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-500" /> Posts
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Events
          </span>
        </div>
        <Calendar
          onChange={onDateChange}
          value={selectedDate}
          tileContent={tileContent}
          className="mx-auto w-full max-w-md border-0 bg-transparent text-foreground"
        />
        <div className="mt-4 space-y-3 text-left text-sm">
          <p className="font-medium text-foreground">
            {format(selectedDate, "MMMM d, yyyy")}
          </p>
          {postsForDate.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Posts ({postsForDate.length})
              </p>
            </div>
          )}
          {eventsForDate.length > 0 && (
            <ul className="space-y-2">
              {eventsForDate.map((ev, i) => (
                <li key={i} className="text-muted-foreground">
                  {ev.name || ev.parsed?.Name || "Event"}
                </li>
              ))}
            </ul>
          )}
          {postsForDate.length === 0 && eventsForDate.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nothing on {formatDate(selectedDate)}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
