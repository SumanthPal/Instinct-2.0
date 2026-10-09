import { fetchEventsRange } from "@/lib/api";
import { normalizeQuery } from "@/lib/queryCache";

// The API has no text search for events, so the ⌘K palette loads the next
// 92 days once (GET /events, the calendar's endpoint, ~120 KB) and filters
// on the client. The list is reused for 10 minutes.
const RANGE_DAYS = 92; // the /events maximum, both ends inclusive
const MAX_AGE_MS = 10 * 60 * 1000;
let cached = null; // { at, promise }

const laDate = (d) =>
	new Intl.DateTimeFormat("en-CA", {
		timeZone: "America/Los_Angeles",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(d);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Thu, Oct 8" or "Thu, Oct 8 · 7:30 PM" from the API's naive LA timestamp. */
export function formatEventWhen(iso) {
	const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso || "");
	if (!m) return "";
	const [, y, mo, d, h = "00", mi = "00"] = m;
	const day = new Date(Date.UTC(+y, +mo - 1, +d)).getUTCDay();
	let out = `${DAYS[day]}, ${MONTHS[+mo - 1]} ${+d}`;
	if (h !== "00" || mi !== "00") {
		const hour = +h % 12 || 12;
		out += ` · ${hour}:${mi} ${+h < 12 ? "AM" : "PM"}`;
	}
	return out;
}

function toItem(row, today) {
	const club = row.clubs || {};
	const name = row.name || row.parsed?.Name || "Untitled event";
	const date = (row.date || "").slice(0, 10);
	return {
		id: row.id,
		name,
		date: row.date,
		// Multi-day events that started earlier open on today in the calendar.
		day: date && date < today ? today : date,
		clubName: club.name || "",
		handle: club.instagram_handle || "",
		avatar: club.profile_image_path || null,
		haystack: normalizeQuery(`${name} ${club.name || ""} ${club.instagram_handle || ""}`),
		nameKey: normalizeQuery(name),
	};
}

/** Upcoming events (today + 91 days), loaded once and shared. Never rejects. */
export function loadUpcomingEvents() {
	if (cached && Date.now() - cached.at < MAX_AGE_MS) return cached.promise;
	const now = new Date();
	const today = laDate(now);
	const to = laDate(new Date(now.getTime() + (RANGE_DAYS - 1) * 86_400_000));
	const promise = fetchEventsRange(new URLSearchParams({ from: today, to }).toString())
		.then((data) => (data.results || []).map((row) => toItem(row, today)))
		.catch((error) => {
			console.error("Error loading events for search:", error);
			cached = null; // try again next time
			return [];
		});
	cached = { at: Date.now(), promise };
	return promise;
}

/**
 * Events whose title, club name or handle contain every word of `query`.
 * Title matches rank first (title starting with the query before that),
 * then soonest first.
 */
export function searchEvents(events, query, limit = 6) {
	const q = normalizeQuery(query);
	if (!q) return [];
	const words = q.split(" ");
	const rank = (ev) => (ev.nameKey.startsWith(q) ? 0 : words.every((w) => ev.nameKey.includes(w)) ? 1 : 2);
	return events
		.filter((ev) => words.every((w) => ev.haystack.includes(w)))
		.map((ev) => ({ ev, r: rank(ev) }))
		.sort((a, b) => a.r - b.r || (a.ev.date < b.ev.date ? -1 : a.ev.date > b.ev.date ? 1 : 0))
		.slice(0, limit)
		.map(({ ev }) => ev);
}

/** The calendar's day view for that date, filtered to the event's club. */
export function eventHref(ev) {
	const q = new URLSearchParams({ view: "day" });
	if (ev.day) q.set("date", ev.day);
	if (ev.handle) q.set("club", ev.handle);
	return `/events?${q}`;
}
