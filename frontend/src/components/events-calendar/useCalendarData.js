"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { addMonths, startOfMonth } from "date-fns";

function monthsBetween(from, to) {
	const out = [];
	for (let m = startOfMonth(from); m < to; m = addMonths(m, 1)) out.push(m);
	return out;
}

// Months are disjoint (an event belongs to the month it starts in).
const merge = (chunks) => (chunks.length === 1 ? chunks[0] : chunks.flat());

/**
 * Events overlapping [from, to) from the cached client, fetched in whole
 * months. GET /events matches on start date, so the month before the range
 * is loaded too: multi-day events that started then still show. Cached months render synchronously (prefetched navigation never
 * flashes), the last result stays up while a new range loads, and the month
 * on either side is prefetched once the visible ones land.
 * `clubs`: null = all campus, [] = nothing to fetch, [...handles] = those clubs.
 */
export function useCalendarData(client, from, to, clubs) {
	const [, bump] = useReducer((x) => x + 1, 0);
	const [error, setError] = useState(null);
	const [nonce, retry] = useReducer((x) => x + 1, 0);
	const none = Array.isArray(clubs) && clubs.length === 0;
	const months = monthsBetween(addMonths(from, -1), to);
	const monthsKey = months.map((m) => m.getTime()).join(",");
	const clubsKey = clubs ? clubs.join(",") : "*";
	const chunks = none ? [] : months.map((m) => client.peek(m, clubs));
	const ready = chunks.every(Boolean);

	useEffect(() => client.subscribe(bump), [client]);

	// Re-runs on range/club change, retry, or a cache miss for the same range.
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed on monthsKey/clubsKey
	useEffect(() => {
		if (none) return;
		let alive = true;
		if (!ready) setError(null);
		Promise.all(months.map((m) => client.getMonth(m, clubs)))
			.then(() => {
				if (!alive) return;
				client.getMonth(addMonths(months[0], -1), clubs).catch(() => {});
				client.getMonth(addMonths(months[months.length - 1], 1), clubs).catch(() => {});
			})
			.catch((e) => alive && setError(e));
		return () => {
			alive = false;
		};
	}, [client, monthsKey, clubsKey, nonce, ready]);

	// Merge once per data change (keyed on the cached chunk identities).
	const memo = useRef({ chunks: null, merged: null, last: [] });
	const m = memo.current;
	if (ready && (!m.chunks || m.chunks.length !== chunks.length || chunks.some((c, i) => c !== m.chunks[i]))) {
		m.chunks = chunks;
		m.merged = merge(chunks);
		m.last = m.merged;
	}
	const events = ready ? (none ? [] : m.merged) : m.last;
	return { events, loading: !ready, error, retry };
}
