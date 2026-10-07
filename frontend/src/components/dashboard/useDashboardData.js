"use client";

import { addDays, format, startOfDay } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { normalizeEvent } from "@/components/events-calendar/calendar-utils";
import { fetchClubManifest, fetchClubPosts, fetchEventsRange } from "@/lib/api";
import { resolveClubImageUrl } from "@/lib/club-image";

export const DAYS_AHEAD = 14;

export function toCard(c) {
	return {
		id: c.id,
		name: c.name || c.club_name,
		description: c.description || c.club_description,
		instagram: c.instagram || c.instagram_handle,
		profilePicture: c.profilePicture || c.profile_picture || c.profile_image_path,
		categories: Array.isArray(c.categories) ? c.categories : [],
	};
}

const catName = (x) => (typeof x === "string" ? x : x?.name);

/**
 * Everything the dashboard shows, derived from the starred clubs:
 * - events: GET /events?clubs=<starred>&from=today&to=+13d (one request, <=100 clubs)
 * - posts: GET /club/<h>/posts?limit=6 per starred club (first 12 clubs), image posts only
 * - suggested: GET /club?category=<top category> minus clubs already starred
 */
export function useDashboardData(clubs, now) {
	const [events, setEvents] = useState(null);
	const [posts, setPosts] = useState(null);
	const [suggested, setSuggested] = useState(null);
	const handles = useMemo(() => clubs.map((c) => c.instagram).filter(Boolean), [clubs]);
	const key = handles.join(",");
	const topCategory = useMemo(() => {
		const n = {};
		for (const c of clubs) for (const x of c.categories) n[catName(x)] = (n[catName(x)] || 0) + 1;
		return Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
	}, [clubs]);

	useEffect(() => {
		if (!key) {
			setEvents([]);
			setPosts([]);
			return;
		}
		const ctrl = new AbortController();
		const from = startOfDay(now);
		const q = new URLSearchParams({
			clubs: handles.slice(0, 100).join(","),
			from: format(from, "yyyy-MM-dd"),
			to: format(addDays(from, DAYS_AHEAD - 1), "yyyy-MM-dd"),
		});
		fetchEventsRange(q.toString(), { signal: ctrl.signal })
			.then((d) => {
				const pics = Object.fromEntries(clubs.map((c) => [c.instagram, c.profilePicture]));
				const list = (d.results || [])
					.map(normalizeEvent)
					.filter((e) => e && e.end > now)
					.map((e) => ({ ...e, avatar: resolveClubImageUrl(e.club?.avatar || pics[e.club?.handle]) }))
					.sort((a, b) => a.startMs - b.startMs);
				setEvents(list);
			})
			.catch((e) => e.name !== "AbortError" && setEvents([]));
		Promise.all(
			handles.slice(0, 12).map((h) =>
				fetchClubPosts(h, 1, 6).then((r) => {
					const club = clubs.find((c) => c.instagram === h);
					return r.results.filter((p) => p.image_url).map((p) => ({ ...p, club }));
				}),
			),
		).then((all) => {
			if (ctrl.signal.aborted) return;
			setPosts(
				all
					.flat()
					.sort((a, b) => String(b.posted || "").localeCompare(String(a.posted || "")))
					.slice(0, 12),
			);
		});
		return () => ctrl.abort();
	}, [key]); // eslint-disable-line

	useEffect(() => {
		let live = true;
		fetchClubManifest(1, 24, topCategory || undefined).then((r) => {
			if (!live) return;
			const mine = new Set(handles);
			setSuggested(r.results.map(toCard).filter((c) => !mine.has(c.instagram)).slice(0, 6));
		});
		return () => {
			live = false;
		};
	}, [topCategory, key]); // eslint-disable-line

	return { events, posts, suggested, topCategory };
}
