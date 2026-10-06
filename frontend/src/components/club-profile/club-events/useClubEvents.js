"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { normalizeEvent } from "@/components/events-calendar/calendar-utils";
import { fetchClubEventRows } from "@/lib/api";

/**
 * One club's whole event history in a single GET /events?clubs=<handle>
 * (club mode, #123). Nothing is fetched until the tab is first opened
 * (`active`); after that the result stays for the life of the page.
 * Every event gets the brand tone: within one club, category colour says
 * nothing.
 * -> { status: idle | loading | ready | error, events, upcoming, past, now, retry }
 */
export function useClubEvents(handle, active) {
	const [state, setState] = useState({ status: "idle", events: [], now: null });
	const [nonce, retry] = useReducer((x) => x + 1, 0);
	const started = active || state.status !== "idle";

	// biome-ignore lint/correctness/useExhaustiveDependencies: nonce is the retry trigger
	useEffect(() => {
		if (!handle || !started) return;
		const ctrl = new AbortController();
		setState((s) => (s.status === "ready" ? s : { ...s, status: "loading" }));
		fetchClubEventRows(handle.toLowerCase(), { signal: ctrl.signal })
			.then((d) => {
				const events = [];
				for (const row of d.results || []) {
					const ev = normalizeEvent(row);
					if (ev) events.push({ ...ev, tone: "career" });
				}
				setState({ status: "ready", events, now: new Date() });
			})
			.catch((e) => {
				if (ctrl.signal.aborted) return;
				console.error("Error loading club events:", e);
				setState((s) => ({ ...s, status: "error" }));
			});
		return () => ctrl.abort();
	}, [handle, started, nonce]);

	const split = useMemo(() => {
		const nowMs = (state.now || new Date()).getTime();
		return {
			upcoming: state.events.filter((ev) => ev.endMs > nowMs).sort((a, b) => a.startMs - b.startMs),
			past: state.events.filter((ev) => ev.endMs <= nowMs).sort((a, b) => b.startMs - a.startMs),
		};
	}, [state.events, state.now]);

	return { ...state, ...split, retry };
}
