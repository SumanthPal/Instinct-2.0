/**
 * Client fetch layer for the calendar, matching backend PR #113:
 *   GET /events?from=YYYY-MM-DD&to=YYYY-MM-DD[&clubs=h1,h2][&category=Name]
 *   from/to: inclusive America/Los_Angeles dates (an event is in range when
 *   its start date is); > 92 days or to < from -> 400; malformed -> 422.
 *   clubs: <= 100 lowercased handles, never empty (-> 400). category: exact
 *   club category name. clubs AND category. -> { count, results } sorted by
 *   date then id; rows = /events/campus-wide shape + `categories`.
 *
 * `source` picks what answers that request:
 *   live                   the real API (the default; falls back to
 *                          /events/campus-wide while /events 404s)
 *   sample | stress | scale  an in-browser implementation of the same
 *                          endpoint (same validation and status codes) over
 *                          fixtures, for ?mock=... test runs
 *
 * The calendar asks in whole calendar months (from = 1st, to = last day);
 * months are cached per club set and normalized once.
 */
import { addDays, addMonths, differenceInCalendarDays, endOfMonth, format, startOfMonth } from "date-fns";
import { fetchCampusWideEvents, fetchClubDirectory, fetchEventsRange } from "@/lib/api";
import { resolveClubImageUrl } from "@/lib/club-image";
import { normalizeEvent } from "./calendar-utils";
import { buildMockEvents, mockClubs } from "./mock-events";
import { scaleClubs, scaleMonth } from "./mock-scale";

export const MAX_RANGE_DAYS = 92;
export const MAX_CLUBS = 100;

const ymd = (d) => format(d, "yyyy-MM-dd");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const normHandle = (h) => h.trim().replace(/^@/, "").toLowerCase();
const byDateThenId = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

class HttpError extends Error {
	constructor(status, detail) {
		super(`GET /events ${status} - ${detail}`);
		this.status = status;
	}
}

/** Query string for one request. Assumes the caller already respected the limits. */
export function eventsQuery({ from, to, clubs, category }) {
	const q = new URLSearchParams({ from: ymd(from), to: ymd(to) });
	if (clubs) q.set("clubs", clubs.join(","));
	if (category) q.set("category", category);
	return q.toString();
}

/** Split [from, to] (inclusive days) into windows of <= 92 days. */
export function splitRange(from, to) {
	const out = [];
	for (let s = from; s <= to; s = addDays(s, MAX_RANGE_DAYS)) {
		const e = addDays(s, MAX_RANGE_DAYS - 1);
		out.push([s, e < to ? e : to]);
	}
	return out;
}

/** Lowercased, de-duplicated handles in groups of <= 100. */
export function chunkClubs(clubs) {
	const handles = [...new Set(clubs.map(normHandle).filter(Boolean))].sort();
	const out = [];
	for (let i = 0; i < handles.length; i += MAX_CLUBS) out.push(handles.slice(i, i + MAX_CLUBS));
	return out;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function parseDay(s) {
	if (!s || !DATE_RE.test(s)) return null;
	const d = new Date(`${s}T00:00:00`);
	return Number.isNaN(d.getTime()) || ymd(d) !== s ? null : d;
}

/** In-browser GET /events over fixture rows, with the server's validation. */
export function mockEventsApi(source, now, density) {
	const fixture = source === "scale" ? null : buildMockEvents(now, { stress: source === "stress" });
	return async (query) => {
		const q = new URLSearchParams(query);
		const from = parseDay(q.get("from"));
		const to = parseDay(q.get("to"));
		if (!from || !to) throw new HttpError(422, "from/to must be YYYY-MM-DD");
		if (to < from) throw new HttpError(400, "`to` is before `from`");
		const days = differenceInCalendarDays(to, from) + 1;
		if (days > MAX_RANGE_DAYS) throw new HttpError(400, `Range is ${days} days; the maximum is ${MAX_RANGE_DAYS}`);
		let handles = null;
		if (q.has("clubs")) {
			handles = new Set(q.get("clubs").split(",").map(normHandle).filter(Boolean));
			if (!handles.size) throw new HttpError(400, "`clubs` has no handles");
			if (handles.size > MAX_CLUBS) throw new HttpError(400, `\`clubs\` has ${handles.size} handles; the maximum is ${MAX_CLUBS}`);
		}
		const category = (q.get("category") || "").trim() || null;
		let rows = fixture;
		if (!rows) {
			rows = [];
			for (let m = startOfMonth(from); m <= to; m = addMonths(m, 1)) rows.push(...scaleMonth(m, density));
		}
		const lo = ymd(from);
		const hi = ymd(to);
		const results = rows
			.filter((r) => {
				const d = r.date.slice(0, 10);
				return (
					d >= lo &&
					d <= hi &&
					(!handles || handles.has(r.clubs?.instagram_handle)) &&
					(!category || r.categories.includes(category))
				);
			})
			.sort(byDateThenId);
		return { count: results.length, results };
	};
}

/** Real API, falling back to campus-wide (no categories) until #113 deploys. */
function liveEventsApi() {
	let fallback = false;
	return async (query) => {
		if (!fallback) {
			try {
				return await fetchEventsRange(query);
			} catch (e) {
				if (e.status !== 404) throw e;
				fallback = true;
			}
		}
		const q = new URLSearchParams(query);
		const end = addDays(new Date(`${q.get("to")}T00:00:00`), 1);
		const d = await fetchCampusWideEvents(`${q.get("from")}T00:00:00`, `${ymd(end)}T00:00:00`, 5000, 0, { throwOnError: true });
		const handles = q.has("clubs") ? new Set(q.get("clubs").split(",")) : null;
		const results = (d.results || [])
			.filter((r) => !handles || handles.has(r.clubs?.instagram_handle))
			.map((r) => ({ ...r, categories: r.categories || [] }));
		return { count: results.length, results };
	};
}

const DIRECTORY_KEY = "instinct:club-directory:v1";
const DIRECTORY_TTL = 6 * 60 * 60 * 1000;
let directoryPromise = null;

/**
 * Every club for the picker, from /club-manifest. Cached for the session in
 * memory and for 6 hours in localStorage: a stale copy is served at once and
 * refreshed in the background.
 */
function loadClubDirectory(onUpdate) {
	let cached = null;
	try {
		cached = JSON.parse(localStorage.getItem(DIRECTORY_KEY) || "null");
	} catch {}
	if (cached?.clubs?.length) onUpdate(cached.clubs);
	if (cached?.clubs?.length && Date.now() - cached.at < DIRECTORY_TTL) return;
	directoryPromise ??= fetchClubDirectory()
		.then((rows) =>
			rows
				.filter((c) => c.instagram_handle)
				.map((c) => ({
					id: c.id,
					name: c.name || c.instagram_handle,
					instagram_handle: c.instagram_handle.toLowerCase(),
					profile_image_path: resolveClubImageUrl(c.profile_image_path || c.profile_pic),
				})),
		)
		.catch(() => null);
	directoryPromise.then((clubs) => {
		if (!clubs?.length) return;
		onUpdate(clubs);
		try {
			localStorage.setItem(DIRECTORY_KEY, JSON.stringify({ at: Date.now(), clubs }));
		} catch {}
	});
}

export function createEventsClient({ source = "live", now = new Date(), latency = 120, density = 1 } = {}) {
	const api = source === "live" ? liveEventsApi() : mockEventsApi(source, now, density);
	const resolved = new Map(); // key -> normalized events
	const pending = new Map(); // key -> Promise
	const listeners = new Set();
	const log = []; // every request URL, for debugging / perf runs
	const seenClubs = new Map();
	let directory = null; // live: every club, from /club-manifest
	let clubsSnap = null; // what clubs() returns until it changes

	const notify = () => {
		for (const fn of listeners) fn();
	};
	if (source === "live" && typeof window !== "undefined") {
		loadClubDirectory((clubs) => {
			directory = clubs;
			clubsSnap = null;
			notify();
		});
	}

	async function get(query) {
		log.push(`/events?${query}`);
		if (source !== "live") await sleep(latency);
		return api(query);
	}

	/**
	 * Any range and club set, split to stay inside the server limits:
	 * <= 92-day windows x <= 100-handle chunks, requested in parallel.
	 */
	async function fetchRange({ from, to, clubs = null, category = null }) {
		const clubChunks = clubs ? chunkClubs(clubs) : [null];
		if (!clubChunks.length) return []; // never send an empty clubs param
		const jobs = [];
		for (const [s, e] of splitRange(from, to)) {
			for (const c of clubChunks) jobs.push(get(eventsQuery({ from: s, to: e, clubs: c, category })));
		}
		const pages = await Promise.all(jobs);
		const rows = pages.flatMap((p) => p.results).sort(byDateThenId);
		const out = [];
		for (const r of rows) {
			if (r.clubs && !seenClubs.has(r.clubs.instagram_handle)) {
				seenClubs.set(r.clubs.instagram_handle, { ...r.clubs, categories: r.categories });
				if (!directory) clubsSnap = null;
			}
			const ev = normalizeEvent(r);
			if (ev) out.push(ev);
		}
		return out;
	}

	const key = (month, clubs) => `${ymd(startOfMonth(month))}|${clubs ? chunkClubs(clubs).flat().join(",") : "*"}`;

	// A club-filtered month is a subset of the all-campus month: derive it
	// locally when that is already cached instead of asking again.
	function fromAll(month, clubs) {
		if (!clubs) return undefined;
		const all = resolved.get(key(month, null));
		if (!all) return undefined;
		const set = new Set(chunkClubs(clubs).flat());
		const out = all.filter((ev) => set.has(ev.club?.handle));
		resolved.set(key(month, clubs), out);
		return out;
	}

	return {
		source,
		log,
		fetchRange,
		/** Synchronous cache read: events starting in that month, or undefined. */
		peek(month, clubs) {
			return resolved.get(key(month, clubs)) ?? fromAll(month, clubs);
		},
		/** Cached fetch of one calendar month (from = 1st, to = last day). */
		getMonth(month, clubs) {
			const k = key(month, clubs);
			const hit = resolved.get(k) ?? fromAll(month, clubs);
			if (hit) return Promise.resolve(hit);
			if (pending.has(k)) return pending.get(k);
			const from = startOfMonth(month);
			const p = fetchRange({ from, to: endOfMonth(from), clubs })
				.then((events) => {
					resolved.set(k, events);
					pending.delete(k);
					notify();
					return events;
				})
				.catch((e) => {
					pending.delete(k);
					throw e;
				});
			pending.set(k, p);
			return p;
		},
		/** Drop everything cached (a hard refresh; perf runs use it for cold numbers). */
		clear() {
			resolved.clear();
		},
		subscribe(fn) {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
		/**
		 * Clubs for the picker: the full directory (live) or fixture list
		 * (mocks). Until the directory arrives, the clubs seen in events.
		 * Returns the same array until it changes (a useSyncExternalStore
		 * snapshot; subscribe() fires on changes).
		 */
		clubs() {
			if (clubsSnap) return clubsSnap;
			if (source === "scale") clubsSnap = scaleClubs();
			else if (source !== "live") clubsSnap = mockClubs();
			else clubsSnap = directory ?? [...seenClubs.values()];
			return clubsSnap;
		},
	};
}
