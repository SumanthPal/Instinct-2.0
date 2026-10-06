"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { likesService } from "@/lib/like-service";
import { scaleStarred } from "./mock-scale";

/**
 * Starred clubs for "For you", from the app's existing favorites
 * (Supabase user_liked_clubs via likesService). Mock sources can simulate a
 * signed-in user with ?user=demo (&stars=N for a big star list).
 * -> { status: "loading" | "signed-out" | "ready", handles: string[] }
 */
export function useStarredClubs(source, demo, stars = 14) {
	const { user, loading } = useAuth() || {};
	const [state, setState] = useState({ status: "loading", handles: [] });

	useEffect(() => {
		if (!source) return; // page not set up yet
		if (source !== "live") {
			if (!demo) return setState({ status: "signed-out", handles: [] });
			const handles =
				source === "scale" ? scaleStarred(stars) : ["acm.uci", "hackatuci", "wics_uci", "isa.uci", "uci_outdoors", "asuci"];
			return setState({ status: "ready", handles });
		}
		if (loading) {
			// Don't hold the calendar hostage to a slow auth check: show All campus.
			const t = setTimeout(() => setState((s) => (s.status === "loading" ? { status: "signed-out", handles: [] } : s)), 2500);
			return () => clearTimeout(t);
		}
		if (!user) return setState({ status: "signed-out", handles: [] });
		let alive = true;
		likesService
			.getLikedClubs()
			.then((clubs) => alive && setState({ status: "ready", handles: clubs.map((c) => c.instagram) }))
			.catch(() => alive && setState({ status: "ready", handles: [] }));
		return () => {
			alive = false;
		};
	}, [source, demo, stars, user, loading]);

	return state;
}
