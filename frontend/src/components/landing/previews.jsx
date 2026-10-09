import Link from "next/link";
import { FiStar, FiInstagram } from "react-icons/fi";
import { Avatar } from "./avatar";
import { durationMinutes } from "@/components/events-calendar/calendar-utils";

/*
 * Landing previews. Server components: data arrives as props from the
 * revalidated server fetch in app/page.js, so nothing here depends on the
 * browser's clock or locale (no hydration mismatch). The mockups are
 * decorative and hidden from assistive tech; the real content is the copy
 * and links next to them.
 */

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
  if (n == null || n === "" || !Number.isFinite(v)) return null;
  return v.toLocaleString("en-US");
}

// API dates are naive ("2026-10-28T00:00:00"); use the calendar day as written.
export function parseLocalDate(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

const CAMPUS_TZ = "America/Los_Angeles";
const CAMPUS_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: CAMPUS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
// Formats a wall-clock instant built with Date.UTC, so the server's own
// timezone never shifts it.
const SPAN_DAY = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });

/**
 * Campus wall-clock time of an API date as a UTC-based Date. Naive strings
 * ("2026-10-06T19:00:00") are already Irvine time; strings with Z or an
 * offset are converted to America/Los_Angeles.
 */
function campusClock(s) {
  const str = String(s || "");
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(str)) {
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return null;
    const p = Object.fromEntries(CAMPUS_PARTS.formatToParts(d).map((x) => [x.type, x.value]));
    return new Date(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute));
  }
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)));
}

function clockLabel(d) {
  const h = d.getUTCHours() % 12 || 12;
  const m = d.getUTCMinutes();
  return m ? `${h}:${String(m).padStart(2, "0")}` : `${h}`;
}
const meridiem = (d) => (d.getUTCHours() < 12 ? "AM" : "PM");

/**
 * When an event happens, in campus time, matching the /events calendar:
 * "7 – 8 PM", "11:30 AM – 1 PM", "All day", or "Oct 9 – Oct 11" for
 * multi-day spans (shown once, never as a run of daily entries).
 */
export function eventWhen(e) {
  const start = campusClock(e?.parsed?.Date || e?.date);
  if (!start) return "";
  const mins = durationMinutes(e);
  const midnight = start.getUTCHours() === 0 && start.getUTCMinutes() === 0;
  if (mins >= 1440 || (midnight && mins === 0)) {
    const days = Math.max(1, Math.ceil(mins / 1440));
    if (days === 1) return "All day";
    const last = new Date(start.getTime() + (days - 1) * 86_400_000);
    return `${SPAN_DAY.format(start)} – ${SPAN_DAY.format(last)}`;
  }
  const end = new Date(start.getTime() + (mins > 0 ? mins : 60) * 60_000);
  const from = meridiem(start) === meridiem(end) ? clockLabel(start) : `${clockLabel(start)} ${meridiem(start)}`;
  return `${from} – ${clockLabel(end)} ${meridiem(end)}`;
}

const MONTH_LONG = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const MONTH_SHORT = new Intl.DateTimeFormat("en-US", { month: "short" });
const DAY_SHORT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

/* Clubs: a compact copy of the club profile header for one real club. */
export function ProfilePreview({ club }) {
  if (!club) return <PreviewEmpty>Club profiles will show up here once the directory loads.</PreviewEmpty>;
  const cats = categoryList(club);
  const followers = formatCount(club.followers);
  return (
    <div aria-hidden="true" className="rounded-xl border border-border bg-card p-6 text-card-foreground">
      <div className="flex items-start gap-5">
        <span className="inline-flex rounded-full bg-[color:var(--accent-brand)] p-[3px]">
          <span className="inline-flex rounded-full bg-card p-[2px]">
            <Avatar src={club.profile_image_path} className="h-16 w-16" ring={false} />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold tracking-tight">{plainText(club.name)}</p>
          <p className="text-sm text-muted-foreground">@{club.instagram_handle}</p>
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
        <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[color:var(--accent-brand-solid)] px-3 text-xs font-medium text-white">
          <FiStar className="h-3 w-3" style={{ fill: "currentColor" }} /> Favorite
        </span>
        <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium">
          <FiInstagram className="h-3.5 w-3.5" /> Instagram
        </span>
      </div>
      <div className="mt-6 grid grid-cols-2 border-t border-border text-center text-xs font-medium uppercase tracking-wider">
        <span className="relative py-3 text-foreground">
          Posts
          <span className="absolute inset-x-1/4 top-0 h-[1.5px] bg-[color:var(--accent-brand)]" />
        </span>
        <span className="py-3 text-muted-foreground">Events</span>
      </div>
    </div>
  );
}

/*
 * Events: month grid for the soonest event's month with its event days
 * marked, plus the next few events. Events in later months are listed under
 * the grid so nothing in the list is missing from the calendar.
 * `todayISO` (YYYY-MM-DD, campus time) comes from the server.
 */
export function EventsPreview({ events, todayISO }) {
  const dated = events
    .map((e) => ({ e, d: parseLocalDate(e.date) }))
    .filter((x) => x.d);
  const today = parseLocalDate(todayISO) || null;
  const ref = dated[0]?.d || today || new Date(2026, 0, 1);
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = new Date(year, month, 1).getDay();
  const inMonth = (d) => d.getFullYear() === year && d.getMonth() === month;
  const eventDays = new Set(dated.filter((x) => inMonth(x.d)).map((x) => x.d.getDate()));
  const later = dated.filter((x) => !inMonth(x.d));
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div aria-hidden="true" className="rounded-xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-medium">{MONTH_LONG.format(ref)}</p>
        <div className="grid grid-cols-7 gap-y-1 text-center text-[11px] text-muted-foreground">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={`${d}-${i}`} className="pb-1">{d}</span>
          ))}
          {cells.map((day, i) => {
            const isToday =
              day &&
              today &&
              today.getFullYear() === year &&
              today.getMonth() === month &&
              today.getDate() === day;
            const has = day && eventDays.has(day);
            return (
              <span
                key={`c-${i}`}
                className={`relative mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs tabular-nums ${
                  has ? "bg-[color:var(--accent-brand-solid)] font-medium text-white" : isToday ? "border border-border text-foreground" : day ? "text-foreground/80" : ""
                }`}
              >
                {day || ""}
              </span>
            );
          })}
        </div>
        {later.length > 0 && (
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
            Later: {later.map((x) => DAY_SHORT.format(x.d)).join(", ")}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {events.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            No upcoming events to show right now.
          </div>
        )}
        {events.slice(0, 3).map((e) => {
          const d = parseLocalDate(e.date);
          return (
            <div key={e.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="w-11 shrink-0 rounded-lg border border-border py-1 text-center">
                  <p className="text-[10px] font-medium uppercase text-muted-foreground">
                    {d ? MONTH_SHORT.format(d) : ""}
                  </p>
                  <p className="text-base font-semibold leading-tight tabular-nums">{d?.getDate()}</p>
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">{plainText(e.name)}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {[eventWhen(e), e.clubs?.name].filter(Boolean).join(" · ")}
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
  if (!clubs?.length) return <PreviewEmpty>Starred clubs appear on your dashboard.</PreviewEmpty>;
  return (
    <div aria-hidden="true" className="rounded-xl border border-border bg-card">
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
            <Avatar src={c.profile_image_path} className="h-9 w-9" sizes="36px" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{plainText(c.name)}</p>
              <p className="truncate text-xs text-muted-foreground">@{c.instagram_handle}</p>
            </div>
            <span className="hidden truncate text-xs text-muted-foreground sm:block sm:max-w-[9rem]">
              {categoryList(c)[0]}
            </span>
            <FiStar className="instinct-star-fill h-4 w-4 shrink-0" />
          </li>
        ))}
      </ul>
    </div>
  );
}

// Shown when the API returned nothing: a static note, never a pulsing skeleton.
function PreviewEmpty({ children }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
      {children}
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
