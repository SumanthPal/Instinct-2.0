"use client";

import { useMemo } from "react";
import Image from "next/image";
import Calendar from "react-calendar";
import {
  FaDownload,
  FaGlobe,
  FaLink,
  FaExternalLinkAlt,
  FaClock,
  FaMapMarkerAlt,
} from "react-icons/fa";
import { format } from "date-fns";
import {
  dateKeySet,
  formatDate,
  getItemDateTime,
  getItemsForDate,
  isDateOnly,
  rawItemDate,
  safeHttpUrl,
} from "./clubDetailUtils";
import "../../../styles/CalendarStyles.css";

function truncate(text, max) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function formatItemTime(item, type) {
  const dt = getItemDateTime(item, type);
  if (!dt) return "";
  return format(dt, isDateOnly(rawItemDate(item, type)) ? "PP" : "PPp");
}

function EventItem({ event, onImageClick }) {
  const name = event.parsed?.Name || event.name || "Event";
  const details = event.parsed?.Details || event.details || event.caption;
  const location = event.parsed?.Location || event.location;
  const when = formatItemTime(event, "event");

  return (
    <li className="py-4 text-left">
      <p className="text-sm font-medium text-foreground">{name}</p>
      {event.image_url && (
        <button
          type="button"
          onClick={() => onImageClick?.(event.image_url, event)}
          className="relative mt-3 block h-40 w-full overflow-hidden rounded-md bg-muted"
          aria-label={`Open image for ${name}`}
        >
          <Image
            src={event.image_url}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 768px"
            loading="lazy"
            unoptimized
          />
        </button>
      )}
      {details && (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {details}
        </p>
      )}
      <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
        {when && (
          <span className="inline-flex items-center gap-1.5">
            <FaClock className="h-3 w-3 shrink-0" aria-hidden="true" />
            {when}
          </span>
        )}
        {location && (
          <span className="inline-flex items-center gap-1.5">
            <FaMapMarkerAlt className="h-3 w-3 shrink-0" aria-hidden="true" />
            {location}
          </span>
        )}
      </div>
    </li>
  );
}

function PostItem({ post }) {
  const postUrl = safeHttpUrl(post.post_url);
  const when = formatItemTime(post, "post");
  return (
    <li className="rounded-md border border-border/60 p-3">
      {post.caption && (
        <p className="text-sm text-foreground wrap-break-word">
          {truncate(post.caption, 150)}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        {when && <span>{when}</span>}
        {postUrl && (
          <a
            href={postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
          >
            View on Instagram
            <FaExternalLinkAlt className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
      </div>
    </li>
  );
}

export default function ClubEventsPanel({
  clubData,
  clubEvents,
  clubPosts,
  selectedDate,
  onDateChange,
  calendarUrl,
  onImageClick,
}) {
  const postDays = useMemo(() => dateKeySet(clubPosts, "post"), [clubPosts]);
  const eventDays = useMemo(() => dateKeySet(clubEvents, "event"), [clubEvents]);

  // Upcoming soonest-first, then past most-recent-first. Undated events last.
  const { upcoming, past } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dated = [];
    const undated = [];
    for (const ev of clubEvents || []) {
      const dt = getItemDateTime(ev, "event");
      if (dt) dated.push({ ev, dt });
      else undated.push(ev);
    }
    const up = dated.filter((x) => x.dt >= today).sort((a, b) => a.dt - b.dt);
    const pa = dated.filter((x) => x.dt < today).sort((a, b) => b.dt - a.dt);
    return {
      upcoming: up.map((x) => x.ev),
      past: [...pa.map((x) => x.ev), ...undated],
    };
  }, [clubEvents]);

  const tileContent = ({ date, view }) => {
    if (view !== "month") return null;
    const key = formatDate(date);
    const hasPost = postDays.has(key);
    const hasEvent = eventDays.has(key);
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
  const links = (Array.isArray(clubData?.club_links) ? clubData.club_links : [])
    .map((l) => ({ ...l, href: safeHttpUrl(l?.url) }))
    .filter((l) => l.href);

  return (
    <div className="space-y-6 px-4 py-6 sm:px-0">
      {clubEvents.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">No events.</p>
      ) : (
        <>
          <section aria-labelledby="club-events-upcoming">
            <h3
              id="club-events-upcoming"
              className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Upcoming
            </h3>
            {upcoming.length === 0 ? (
              <p className="py-3 text-left text-sm text-muted-foreground">
                No upcoming events.
              </p>
            ) : (
              <ul className="divide-y divide-border/40">
                {upcoming.map((ev, i) => (
                  <EventItem
                    key={ev.id || `${ev.name}-${i}`}
                    event={ev}
                    onImageClick={onImageClick}
                  />
                ))}
              </ul>
            )}
          </section>
          {past.length > 0 && (
            <section aria-labelledby="club-events-past">
              <h3
                id="club-events-past"
                className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Past
              </h3>
              <ul className="divide-y divide-border/40">
                {past.map((ev, i) => (
                  <EventItem
                    key={ev.id || `${ev.name}-${i}`}
                    event={ev}
                    onImageClick={onImageClick}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {links.length > 0 && (
        <div className="rounded-md border border-border bg-card p-4 text-left">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Links</h3>
          <div className="space-y-2">
            {links.map((linkData, index) => (
              <a
                key={`${linkData.href}-${index}`}
                href={linkData.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[44px] items-center gap-3 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                <FaLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1 truncate font-medium">
                  {truncate(linkData.text || linkData.href, 40)}
                </span>
                <FaExternalLinkAlt className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      )}

      {calendarUrl && (
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-center">
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
              <FaDownload className="h-4 w-4" aria-hidden="true" />
              Download Calendar
            </button>
            <button
              type="button"
              onClick={() =>
                window.open(calendarUrl.replace("https", "webcal"))
              }
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              <FaGlobe className="h-4 w-4" aria-hidden="true" />
              Subscribe
            </button>
          </div>
        </div>
      )}

      <div className="rounded-md border border-border bg-card p-3 calendar-responsive">
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
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                Posts ({postsForDate.length})
              </p>
              <ul className="space-y-2">
                {postsForDate.map((post, i) => (
                  <PostItem key={post.id || i} post={post} />
                ))}
              </ul>
            </div>
          )}
          {eventsForDate.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Events ({eventsForDate.length})
              </p>
              <ul className="divide-y divide-border/40">
                {eventsForDate.map((ev, i) => (
                  <EventItem
                    key={ev.id || i}
                    event={ev}
                    onImageClick={onImageClick}
                  />
                ))}
              </ul>
            </div>
          )}
          {postsForDate.length === 0 && eventsForDate.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nothing on {format(selectedDate, "MMM d")}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
