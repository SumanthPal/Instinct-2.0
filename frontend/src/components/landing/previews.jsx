"use client";

import { useState } from "react";
import Link from "next/link";
import { FaUserCircle, FaStar, FaInstagram } from "react-icons/fa";

/* Helpers shared by the landing previews. All content comes from the API. */

const PICTOGRAPHS = /[\u{2600}-\u{27BF}\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/gu;

// Instagram bios: keep the quoted bio text and drop emoji for the landing previews.
export function cleanDescription(str) {
  if (!str) return "";
  const matches = str.match(/"([^"]*)"/g);
  const text = matches ? matches.map((m) => m.slice(1, -1)).join(" ") : str;
  return plainText(text);
}

export function plainText(s) {
  return (s || "").replace(PICTOGRAPHS, " ").replace(/\s{2,}/g, " ").trim();
}

export function categoryList(club) {
  return (club?.categories || [])
    .map((c) => (typeof c === "string" ? c : c?.name))
    .filter(Boolean);
}

export function formatCount(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return v.toLocaleString();
}

function parseLocalDate(s) {
  // API dates are naive ("2026-10-28T00:00:00"); treat as local time.
  if (!s) return null;
  const [d] = s.split("T");
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

export function Avatar({ src, className = "h-10 w-10" }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted ${className}`}
    >
      {src && !failed ? (
        // biome-ignore lint/performance/noImgElement: remote R2 avatars, unoptimized like ClubCard
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <FaUserCircle className="h-full w-full text-muted-foreground" aria-hidden="true" />
      )}
    </span>
  );
}

/* Clubs: a compact copy of the club profile header for one real club. */
export function ProfilePreview({ club }) {
  if (!club) return <PreviewSkeleton rows={4} />;
  const cats = categoryList(club);
  const followers = formatCount(club.followers);
  return (
    <div className="rounded-md border border-border bg-card p-6 text-card-foreground">
      <div className="flex items-start gap-5">
        <span className="inline-flex rounded-full bg-[color:var(--accent-brand)] p-[2px]">
          <span className="inline-flex rounded-full bg-card p-[2px]">
            <Avatar src={club.profile_image_path} className="h-16 w-16" />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold tracking-tight">{plainText(club.name)}</p>
          <p className="font-mono text-sm text-muted-foreground">@{club.instagram_handle}</p>
          {followers && (
            <p className="mt-2 text-sm">
              <span className="font-semibold tabular-nums">{followers}</span>{" "}
              <span className="text-muted-foreground">followers</span>
            </p>
          )}
        </div>
      </div>
      <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
        {cleanDescription(club.description)}
      </p>
      {cats.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">{cats.slice(0, 3).join(" · ")}</p>
      )}
      <div className="mt-5 flex gap-2">
        <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[color:var(--accent-brand)] px-3 text-xs font-medium text-white">
          <FaStar className="h-3 w-3" /> Favorite
        </span>
        <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium">
          <FaInstagram className="h-3.5 w-3.5" /> Instagram
        </span>
      </div>
      <div className="mt-6 grid grid-cols-2 border-t border-border text-center text-xs font-medium uppercase tracking-wider">
        <span className="relative py-3 text-foreground">
          Posts
          <span className="absolute inset-x-1/4 top-0 h-0.5 bg-[color:var(--accent-brand)]" />
        </span>
        <span className="py-3 text-muted-foreground">Events</span>
      </div>
    </div>
  );
}

/* Events: month grid with real event days marked, plus the event list. */
export function EventsPreview({ events, loaded }) {
  const first = events[0] ? parseLocalDate(events[0].date) : null;
  const ref = first || new Date();
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = new Date(year, month, 1).getDay();
  const today = new Date();
  const eventDays = new Set(
    events
      .map((e) => parseLocalDate(e.date))
      .filter((d) => d && d.getFullYear() === year && d.getMonth() === month)
      .map((d) => d.getDate()),
  );
  const monthLabel = ref.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="rounded-md border border-border bg-card p-4">
        <p className="mb-3 text-sm font-medium">{monthLabel}</p>
        <div className="grid grid-cols-7 gap-y-1 text-center text-[11px] text-muted-foreground">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={`${d}-${i}`} className="pb-1">{d}</span>
          ))}
          {cells.map((day, i) => {
            const isToday =
              day &&
              today.getFullYear() === year &&
              today.getMonth() === month &&
              today.getDate() === day;
            const has = day && eventDays.has(day);
            return (
              <span
                key={`c-${i}`}
                className={`relative mx-auto flex h-7 w-7 items-center justify-center rounded-md text-xs tabular-nums ${
                  has ? "bg-[color:var(--accent-brand)] font-medium text-white" : isToday ? "border border-border text-foreground" : day ? "text-foreground/80" : ""
                }`}
              >
                {day || ""}
              </span>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {!loaded && <PreviewSkeleton rows={3} />}
        {loaded && events.length === 0 && (
          <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            No upcoming events have been posted yet.
          </div>
        )}
        {events.slice(0, 3).map((e) => {
          const d = parseLocalDate(e.date);
          return (
            <div key={e.id} className="rounded-md border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="w-11 shrink-0 rounded-md border border-border py-1 text-center">
                  <p className="text-[10px] font-medium uppercase text-muted-foreground">
                    {d?.toLocaleDateString(undefined, { month: "short" })}
                  </p>
                  <p className="text-base font-semibold leading-tight tabular-nums">{d?.getDate()}</p>
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">{plainText(e.name)}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {e.clubs?.name}
                    {e.duration ? ` · ${e.duration}` : ""}
                  </p>
                </div>
              </div>
              {e.details && (
                <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{plainText(e.details)}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Favorites: how starred clubs appear on the dashboard (real clubs, sample selection). */
export function FavoritesPreview({ clubs }) {
  if (!clubs?.length) return <PreviewSkeleton rows={3} />;
  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <p className="text-sm font-medium">Favorites</p>
        <p className="text-xs text-muted-foreground">Dashboard preview</p>
      </div>
      <ul>
        {clubs.map((c, i) => (
          <li
            key={c.id}
            className={`flex items-center gap-3 px-5 py-3.5 ${i > 0 ? "border-t border-border" : ""}`}
          >
            <Avatar src={c.profile_image_path} className="h-9 w-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{plainText(c.name)}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">@{c.instagram_handle}</p>
            </div>
            <span className="hidden truncate text-xs text-muted-foreground sm:block sm:max-w-[9rem]">
              {categoryList(c)[0]}
            </span>
            <FaStar className="h-4 w-4 shrink-0 text-[color:var(--accent-brand)]" aria-label="Favorited" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function PreviewSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-5">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-4 animate-pulse rounded bg-muted" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function ArrowLink({ href, children }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
    >
      {children} <span aria-hidden="true">→</span>
    </Link>
  );
}
