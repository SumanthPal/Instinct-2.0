import {
	addDays,
	addMinutes,
	differenceInCalendarDays,
	differenceInMinutes,
	eachDayOfInterval,
	endOfMonth,
	endOfWeek,
	format,
	startOfDay,
	startOfMonth,
	startOfWeek,
} from "date-fns";

export const WEEK_OPTS = { weekStartsOn: 0 };
export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 22;

/**
 * Events carry their club's real category names (`categories`, from
 * GET /events). Colour is a small explicit map onto the three solid accents;
 * anything unmapped is neutral. Order = precedence when a club has several.
 */
export const TONES = ["career", "academic", "social", "general"];
const TONE_OF = {
	"Career and Professional": "career",
	Networking: "career",
	"Academics and Honors": "academic",
	Education: "academic",
	Graduate: "academic",
	Technology: "academic",
	"Cultural and Social": "social",
	Cultural: "social",
	Multicultural: "social",
	International: "social",
	"Diversity and Inclusion": "social",
	"LGBTQ+": "social",
	"Greek Life": "social",
	"Performance and Entertainment": "social",
	"Creative Arts": "social",
	"Hobbies and Interests": "social",
	"Club Sports": "social",
};
export function toneOf(name) {
	return TONE_OF[name] || "general";
}
export function toneFor(categories) {
	let best = 3;
	for (const c of categories) best = Math.min(best, TONES.indexOf(toneOf(c)));
	return TONES[best];
}

/** Event length in minutes from parsed.Duration or the API's interval string. */
export function durationMinutes(raw) {
	const d = raw.parsed?.Duration;
	if (d && typeof d === "object") {
		return (d.days || 0) * 1440 + (d.hours || 0) * 60 + (d.minutes || 0);
	}
	// "6 days 04:00:00" | "01:30:00"
	if (typeof raw.duration === "string") {
		const m = raw.duration.match(/(?:(\d+)\s+days?)?\s*(?:(\d+):(\d+)(?::\d+)?)?/);
		if (m) return (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0);
	}
	return 0;
}

/**
 * The API's location column is empty for scraped events, but some event
 * details say "Location: HIB 110." Use that label when present; never guess
 * from free text.
 */
export function locationOf(raw) {
	const direct = raw.parsed?.Location || raw.location;
	if (direct) return String(direct).trim();
	const m = String(raw.parsed?.Details || raw.details || "").match(/\blocation\s*:\s*([^\n.;]{2,80})/i);
	return m ? m[1].trim() : "";
}

/** API row (live or mock) -> the shape the calendar renders. */
export function normalizeEvent(raw) {
	const dateStr = raw.parsed?.Date || raw.date;
	if (!dateStr) return null;
	const start = new Date(dateStr);
	if (Number.isNaN(start.getTime())) return null;
	const mins = durationMinutes(raw);
	const midnight = start.getHours() === 0 && start.getMinutes() === 0;
	// Multi-day spans and date-only rows go in the all-day row, like Apple.
	const allDay = mins >= 1440 || (midnight && mins === 0);
	const end = allDay
		? addDays(startOfDay(start), Math.max(1, Math.ceil(mins / 1440)))
		: addMinutes(start, mins > 0 ? mins : 60);
	const title = raw.parsed?.Name || raw.name || "Event";
	const details = raw.parsed?.Details || raw.details || "";
	const categories = Array.isArray(raw.categories) ? raw.categories : [];
	return {
		id: String(raw.id),
		postId: raw.post_id ? String(raw.post_id) : null,
		// GET /events?clubs=<one handle> (#123); often a dead R2 link for older posts.
		postImage: raw.post_image_url || null,
		title,
		details,
		location: locationOf(raw),
		start,
		end,
		startMs: start.getTime(),
		endMs: end.getTime(),
		allDay,
		categories,
		tone: toneFor(categories),
		club: raw.clubs
			? {
					name: raw.clubs.name,
					handle: raw.clubs.instagram_handle,
					avatar: raw.clubs.profile_image_path || null,
				}
			: null,
	};
}

/**
 * All-day spans longer than this many days (application windows, "60-day
 * challenges") are drawn once, on their first day, instead of filling every
 * day of the calendar for weeks.
 */
export const LONG_SPAN_DAYS = 7;

/**
 * Calendar copy of a long all-day span that occupies only its first day.
 * The real end stays in `spanEnd` for labels and the .ics download.
 */
export function collapseLongSpan(ev) {
	if (!ev.allDay || differenceInCalendarDays(ev.end, ev.start) <= LONG_SPAN_DAYS) return ev;
	const end = addDays(startOfDay(ev.start), 1);
	return { ...ev, end, endMs: end.getTime(), spanEnd: ev.end };
}

/** True when the event touches calendar day `day`. */
export function occursOn(ev, day) {
	return ev.startMs < nextDayMs(day) && ev.endMs > dayStartMs(day);
}

export function monthGrid(anchor) {
	return eachDayOfInterval({
		start: startOfWeek(startOfMonth(anchor), WEEK_OPTS),
		end: endOfWeek(endOfMonth(anchor), WEEK_OPTS),
	});
}

export function weekDays(anchor) {
	return eachDayOfInterval({
		start: startOfWeek(anchor, WEEK_OPTS),
		end: endOfWeek(anchor, WEEK_OPTS),
	});
}

// Hot path (index building, every lookup): hand-rolled instead of date-fns format.
const p2 = (n) => (n < 10 ? `0${n}` : `${n}`);
export function dayKey(d) {
	return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}
const MIN = 60_000;
const dayStartMs = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const nextDayMs = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();

// Hand-rolled: rendered for every block/chip/row, where date-fns format shows up in profiles.
function clock(d) {
	const h = d.getHours() % 12 || 12;
	const m = d.getMinutes();
	return m ? `${h}:${p2(m)}` : `${h}`;
}

/** "7 PM", "7:30 PM" */
export function shortTime(d) {
	return `${clock(d)} ${d.getHours() < 12 ? "AM" : "PM"}`;
}

export function timeRange(ev) {
	if (ev.spanEnd) {
		const days = Math.round(differenceInMinutes(ev.spanEnd, ev.start) / 1440);
		return `${format(ev.start, "MMM d")} – ${format(addDays(ev.spanEnd, -1), "MMM d")} · ${days} days`;
	}
	if (ev.allDay) {
		const days = Math.round(differenceInMinutes(ev.end, ev.start) / 1440);
		return days > 1
			? `All day · ${format(ev.start, "MMM d")} – ${format(addDays(ev.end, -1), "MMM d")}`
			: "All day";
	}
	const sameMeridiem = ev.start.getHours() < 12 === ev.end.getHours() < 12;
	return `${sameMeridiem ? clock(ev.start) : shortTime(ev.start)} – ${shortTime(ev.end)}`;
}

/**
 * Hours the time grid must show for `days`: 8 AM–10 PM, stretched to fit
 * anything earlier or later (overnight events end the day at midnight).
 */
export function visibleHours(events, days) {
	let startHour = DAY_START_HOUR;
	let endHour = DAY_END_HOUR;
	for (const day of days) {
		const s = dayStartMs(day);
		const e = nextDayMs(day);
		for (const ev of events) {
			if (ev.allDay || !(ev.startMs < e && ev.endMs > s)) continue;
			const from = ev.startMs > s ? (ev.startMs - s) / MIN : 0;
			const to = ev.endMs < e ? (ev.endMs - s) / MIN : 1440;
			startHour = Math.min(startHour, Math.floor(from / 60));
			endHour = Math.max(endHour, Math.ceil(to / 60));
		}
	}
	return { startHour, endHour: Math.min(24, endHour) };
}

/**
 * Lays timed events for one day out in side-by-side columns, at most
 * `maxCols` per overlap group (Google-style). Blocks that would need a
 * further column are hidden and grouped by the hour they start in.
 * -> { blocks: [{ ev, top, height, col, cols, span, reserve }],
 *      more: [{ hour, top, hidden: ev[] }] }
 * top/height are minutes from `startHour`, clamped to the visible range;
 * `reserve` marks blocks whose group has a "+N" strip on the right.
 */
export function layoutDay(events, day, startHour = DAY_START_HOUR, endHour = DAY_END_HOUR, maxCols = Number.POSITIVE_INFINITY) {
	const ds = dayStartMs(day);
	const de = nextDayMs(day);
	const dayStart = ds + startHour * 60 * MIN; // DST days are off by an hour; fine for a grid
	const range = (endHour - startHour) * 60;
	const items = events
		.filter((ev) => !ev.allDay && ev.startMs < de && ev.endMs > ds)
		.map((ev) => {
			const top = Math.max(0, Math.round((ev.startMs - dayStart) / MIN));
			const bottom = Math.min(range, Math.round((ev.endMs - dayStart) / MIN));
			return { ev, top: Math.min(top, range - 30), bottom: Math.max(bottom, Math.min(top, range - 30) + 30) };
		})
		.sort((a, b) => a.top - b.top || b.bottom - a.bottom);

	const blocks = [];
	const hiddenAll = [];
	let cluster = [];
	let clusterEnd = -1;
	const flush = () => {
		const colEnds = [];
		const shown = [];
		let overflow = false;
		for (const it of cluster) {
			let col = colEnds.findIndex((end) => end <= it.top);
			if (col === -1 && colEnds.length < maxCols) {
				col = colEnds.length;
				colEnds.push(it.bottom);
			} else if (col !== -1) {
				colEnds[col] = it.bottom;
			}
			if (col === -1) {
				overflow = true;
				hiddenAll.push(it);
				continue;
			}
			it.col = col;
			shown.push(it);
		}
		const cols = colEnds.length;
		for (const it of shown) {
			// A block may reach under its right-hand neighbours when they all
			// start well after it, so its title stays readable.
			const later = shown.filter((o) => o.col > it.col && o.top < it.bottom && o.bottom > it.top);
			const canWiden = later.length > 0 && later.every((o) => o.top - it.top >= 30);
			const span = canWiden ? Math.min(cols - it.col, 1.7) : 1;
			blocks.push({ ev: it.ev, top: it.top, height: it.bottom - it.top, col: it.col, cols, span, reserve: overflow });
		}
		cluster = [];
	};
	for (const it of items) {
		if (cluster.length && it.top >= clusterEnd) flush();
		cluster.push(it);
		clusterEnd = Math.max(clusterEnd, it.bottom);
	}
	if (cluster.length) flush();

	const byHour = new Map();
	for (const it of hiddenAll) {
		const hour = Math.floor(it.top / 60);
		if (!byHour.has(hour)) byHour.set(hour, []);
		byHour.get(hour).push(it.ev);
	}
	const more = [...byHour].map(([hour, hidden]) => ({
		hour: startHour + hour,
		top: hour * 60,
		first: Math.min(...hiddenAll.filter((it) => Math.floor(it.top / 60) === hour).map((it) => it.top)),
		hidden,
	}));
	return { blocks, more };
}

/** Timed events overlapping [hour, hour + 1) on `day`. */
export function slotEvents(list, day, hour) {
	const s = dayStartMs(day) + hour * 60 * MIN;
	const e = s + 60 * MIN;
	return list.filter((ev) => !ev.allDay && ev.startMs < e && ev.endMs > s);
}

const EMPTY = Object.freeze([]);
const sortDay = (a, b) => (b.allDay ? 1 : 0) - (a.allDay ? 1 : 0) || a.startMs - b.startMs || b.endMs - a.endMs;

/** dayKey -> events touching that day (sorted all-day first, then by start). */
export function buildDayIndex(events) {
	const map = new Map();
	for (const ev of events) {
		const s = ev.start;
		for (let i = 0; ; i++) {
			const d = new Date(s.getFullYear(), s.getMonth(), s.getDate() + i);
			if (i > 0 && d.getTime() >= ev.endMs) break;
			const k = dayKey(d);
			const list = map.get(k);
			if (list) list.push(ev);
			else map.set(k, [ev]);
		}
	}
	for (const list of map.values()) list.sort(sortDay);
	return map;
}

export function dayList(index, day) {
	return index.get(dayKey(day)) || EMPTY;
}

/** Unique events touching any of `days`, from the index. */
export function eventsInDays(index, days) {
	if (days.length === 1) return dayList(index, days[0]);
	const seen = new Set();
	const out = [];
	for (const d of days) {
		for (const ev of dayList(index, d)) {
			if (seen.has(ev)) continue;
			seen.add(ev);
			out.push(ev);
		}
	}
	return out;
}

export const TIMES = [
	{ id: "morning", label: "Morning", hint: "before 12" },
	{ id: "afternoon", label: "Afternoon", hint: "12–5" },
	{ id: "evening", label: "Evening", hint: "after 5" },
];
export function timeBucket(ev) {
	const h = ev.start.getHours();
	return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

// America/Los_Angeles rules (US DST since 2007). TZID-qualified times need a
// matching VTIMEZONE (RFC 5545 3.6.5).
const ICS_VTIMEZONE = [
	"BEGIN:VTIMEZONE",
	"TZID:America/Los_Angeles",
	"BEGIN:DAYLIGHT",
	"TZOFFSETFROM:-0800",
	"TZOFFSETTO:-0700",
	"TZNAME:PDT",
	"DTSTART:19700308T020000",
	"RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
	"END:DAYLIGHT",
	"BEGIN:STANDARD",
	"TZOFFSETFROM:-0700",
	"TZOFFSETTO:-0800",
	"TZNAME:PST",
	"DTSTART:19701101T020000",
	"RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
	"END:STANDARD",
	"END:VTIMEZONE",
];

// Lines over 75 octets are folded with CRLF + space (RFC 5545 3.1).
function foldIcsLine(line) {
	const enc = new TextEncoder();
	if (enc.encode(line).length <= 75) return line;
	const parts = [];
	let cur = "";
	let bytes = 0;
	for (const ch of line) {
		const n = enc.encode(ch).length;
		if (bytes + n > (parts.length ? 74 : 75)) {
			parts.push(cur);
			cur = "";
			bytes = 0;
		}
		cur += ch;
		bytes += n;
	}
	parts.push(cur);
	return parts.join("\r\n ");
}

/**
 * .ics for "Add to calendar". API times are campus wall-clock times
 * ("2026-10-06T19:00:00" is 7 PM in Irvine), so timed events carry
 * TZID=America/Los_Angeles and import at the right moment from any timezone.
 * All-day events stay DATE values; collapsed long spans export their real end.
 */
export function icsHref(ev, now = new Date()) {
	const end = ev.spanEnd || ev.end;
	const local = (d) => format(d, "yyyyMMdd'T'HHmmss");
	const date = (d) => format(d, "yyyyMMdd");
	const utc = (d) => `${d.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
	const esc = (s) => String(s || "").replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");
	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Instinct//Events//EN",
		"CALSCALE:GREGORIAN",
		...(ev.allDay ? [] : ICS_VTIMEZONE),
		"BEGIN:VEVENT",
		`UID:${ev.id}@instinct`,
		`DTSTAMP:${utc(now)}`,
		ev.allDay ? `DTSTART;VALUE=DATE:${date(ev.start)}` : `DTSTART;TZID=America/Los_Angeles:${local(ev.start)}`,
		ev.allDay ? `DTEND;VALUE=DATE:${date(end)}` : `DTEND;TZID=America/Los_Angeles:${local(end)}`,
		`SUMMARY:${esc(ev.title)}`,
		ev.location ? `LOCATION:${esc(ev.location)}` : null,
		ev.details ? `DESCRIPTION:${esc(ev.details)}` : null,
		"END:VEVENT",
		"END:VCALENDAR",
	].filter(Boolean);
	return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.map(foldIcsLine).join("\r\n"))}`;
}

/**
 * All-day / multi-day events across a run of consecutive days (a week row)
 * as bars: [{ ev, start, end (inclusive col), lane, cutLeft, cutRight }].
 */
export function layoutSpans(events, days) {
	const first = startOfDay(days[0]);
	const last = addDays(startOfDay(days[days.length - 1]), 1);
	const col = (d) => Math.round(differenceInMinutes(startOfDay(d), first) / 1440);
	const spans = events
		.filter((ev) => ev.allDay && ev.start < last && ev.end > first)
		.map((ev) => {
			const s = Math.max(0, col(ev.start));
			const e = Math.min(days.length - 1, col(addMinutes(ev.end, -1)));
			return { ev, start: s, end: e, cutLeft: ev.start < first, cutRight: ev.end > last };
		})
		.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
	const laneEnds = [];
	for (const sp of spans) {
		let lane = laneEnds.findIndex((end) => end < sp.start);
		if (lane === -1) {
			lane = laneEnds.length;
			laneEnds.push(sp.end);
		} else laneEnds[lane] = sp.end;
		sp.lane = lane;
	}
	return { spans, lanes: laneEnds.length };
}
