"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import EventsCalendar from "@/components/events-calendar/EventsCalendar";
import { createEventsClient } from "@/components/events-calendar/events-client";
import { useStarredClubs } from "@/components/events-calendar/favorites";
import { useAuth } from "@/context/auth-context";

const VIEWS = new Set(["month", "week", "day", "list"]);
const MOCKS = new Set(["sample", "stress", "scale"]);

/**
 * Campus events calendar. Data comes from GET /events (backend #113) through
 * events-client.js, falling back to /events/campus-wide while /events 404s.
 * Query params:
 *   ?view=week       starting view (month | week | day | list); otherwise the
 *                    last view picked here, else List for All campus
 *   ?date=2026-12-01 starting date
 *   ?club=hackatuci  open filtered to one club (the club page's Events tab links here)
 * Test-only mocks (an in-browser GET /events with the server's validation):
 *   ?mock=sample     small fixture of real-shaped rows
 *   ?mock=stress     fixture plus edge cases (12-event day, early/late, long titles)
 *   ?mock=scale      ~450 clubs, ~1,000 events/month, peak days 50-58
 *   &density=2       scale x2 for perf runs
 *   &user=demo       pretend to be signed in with starred clubs
 *   &stars=150       with user=demo: that many stars (exercises 100-handle chunks)
 */
export default function CampusEventsPage() {
	const [now, setNow] = useState(null);
	const [setup, setSetup] = useState(null);
	const auth = useAuth() || {};

	// Dates are client-only: the server's clock/timezone would not match.
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const v = params.get("view");
		const d = params.get("date");
		const date = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00`) : null;
		const current = new Date();
		const mock = params.get("mock");
		const club = (params.get("club") || "").trim().replace(/^@/, "").toLowerCase() || null;
		const source = MOCKS.has(mock) ? mock : "live";
		const density = Math.min(4, Math.max(1, Number(params.get("density")) || 1));
		setNow(current);
		setSetup({
			view: VIEWS.has(v) ? v : null,
			date,
			club,
			source,
			density,
			demo: params.get("user") === "demo",
			stars: Number(params.get("stars")) || 14,
			client: createEventsClient({ source, now: current, density }),
		});
		const id = setInterval(() => setNow(new Date()), 60_000);
		return () => clearInterval(id);
	}, []);

	const starred = useStarredClubs(setup?.source, setup?.demo, setup?.stars);
	if (typeof window !== "undefined" && setup && setup.source !== "live") window.__calClient = setup.client; // perf runs read the request log

	const onSignIn = () => {
		if (setup?.source === "live") return auth.signInWithGoogle?.();
		const q = new URLSearchParams(window.location.search);
		q.set("user", "demo");
		window.location.search = q.toString();
	};

	// Live data needs no label; a mock says so.
	const badge =
		setup && setup.source !== "live"
			? {
					sample: "Sample data",
					stress: "Sample data · stress",
					scale: `Scale mock · 450 clubs${setup.density > 1 ? ` · x${setup.density}` : ""}`,
				}[setup.source]
			: null;

	return (
		<div className="flex min-h-screen flex-col overflow-x-clip bg-background text-foreground">
			<Navbar />
			{/* Wider than the 6xl content pages: a calendar wants every column it can get. */}
			<main className="mx-auto w-full max-w-[1360px] flex-1 px-4 pb-16 pt-[84px] sm:px-6">
				<div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
					<div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
						<h1 className="text-2xl font-semibold tracking-tight text-foreground">Events</h1>
						<p className="text-sm text-muted-foreground">What clubs are running across campus</p>
					</div>
					{badge && (
						<span
							className="inline-flex h-6 items-center gap-1.5 rounded-full border border-dashed border-border px-2.5 text-[11px] font-medium text-muted-foreground"
							title="Mock GET /events for testing; drop ?mock= for live data."
						>
							<span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
							{badge}
						</span>
					)}
				</div>
				{now && setup ? (
					<EventsCalendar
						key={setup.view ?? "auto"}
						client={setup.client}
						now={now}
						initialView={setup.view}
						initialDate={setup.date}
						initialClub={setup.club}
						starred={starred}
						onSignIn={onSignIn}
					/>
				) : (
					<CalendarSkeleton />
				)}
			</main>
			<Footer />
		</div>
	);
}

/** Static outline of the calendar so the page doesn't jump before it mounts. */
function CalendarSkeleton() {
	const bar = "rounded-full bg-muted animate-pulse";
	return (
		<div className="flex gap-6" role="status" aria-busy="true">
			<span className="sr-only">Loading events</span>
			<div className="w-[220px] shrink-0 space-y-3 max-lg:hidden">
				<div className={`h-8 w-full ${bar}`} />
				<div className="grid grid-cols-7 gap-2">
					{Array.from({ length: 35 }, (_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder
						<div key={i} className={`mx-auto h-5 w-5 ${bar}`} />
					))}
				</div>
			</div>
			<div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-border bg-card">
				<div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
					<div className={`h-5 w-36 ${bar}`} />
					<div className="flex-1" />
					<div className={`h-8 w-40 max-sm:hidden ${bar}`} />
					<div className={`h-8 w-24 ${bar}`} />
				</div>
				<div className="grid h-[calc(100vh-226px)] min-h-[420px] grid-cols-7 grid-rows-5">
					{Array.from({ length: 35 }, (_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder
							key={i}
							className={`border-border p-2 ${i % 7 ? "border-l" : ""} ${i >= 7 ? "border-t" : ""}`}
						>
							{i % 3 === 1 && <div className={`ml-auto mt-6 h-3 w-4/5 max-sm:hidden ${bar}`} />}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
