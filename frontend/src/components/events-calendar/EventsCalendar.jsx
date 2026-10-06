"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
	addDays,
	addMonths,
	addWeeks,
	endOfMonth,
	endOfWeek,
	format,
	isSameDay,
	isSameMonth,
	isSameYear,
	startOfDay,
	startOfMonth,
	startOfWeek,
} from "date-fns";
import { FiChevronLeft, FiChevronRight, FiSliders } from "react-icons/fi";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import AgendaView from "./AgendaView";
import { CalendarUI, EventDetailsBody, SlotList } from "./EventDetails";
import { ClubSection, FilterPanel, MAX_PICKS, ModeToggle } from "./Filters";
import MiniMonth from "./MiniMonth";
import MonthView from "./MonthView";
import TimeGrid from "./TimeGrid";
import { WEEK_OPTS, buildDayIndex, dayKey, dayList, shortTime, timeBucket, weekDays } from "./calendar-utils";
import { useCalendarData } from "./useCalendarData";

const PHONE = "(max-width: 639px)";

function useIsPhone() {
	const [phone, setPhone] = useState(() => typeof window !== "undefined" && window.matchMedia(PHONE).matches);
	useEffect(() => {
		const mq = window.matchMedia(PHONE);
		const on = () => setPhone(mq.matches);
		on();
		mq.addEventListener("change", on);
		return () => mq.removeEventListener("change", on);
	}, []);
	return phone;
}

/** [start, end) of what the current view shows, for empty states. */
function viewRange(view, anchor) {
	if (view === "week") return [startOfWeek(anchor, WEEK_OPTS), addDays(endOfWeek(anchor, WEEK_OPTS), 1)];
	if (view === "day") return [startOfDay(anchor), addDays(startOfDay(anchor), 1)];
	return [startOfMonth(anchor), addMonths(startOfMonth(anchor), 1)];
}

/** [start, end) of the days the view draws (Month includes the grid's spill days). */
function drawRange(view, anchor) {
	if (view === "month") {
		return [startOfWeek(startOfMonth(anchor), WEEK_OPTS), addDays(endOfWeek(endOfMonth(anchor), WEEK_OPTS), 1)];
	}
	return viewRange(view, anchor);
}

const linkCls =
	"inline-flex min-w-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted";

function EmptyState({ view, anchor, events, visible, picks, onClear, onJump, block }) {
	const [from, to] = viewRange(view, anchor);
	const inRange = (ev) => ev.start < to && ev.end > from;
	if (visible.some(inRange)) return null;
	const filtered = events.some(inRange);
	const next = visible.filter((ev) => ev.start >= to).sort((a, b) => a.start - b.start)[0];
	const label = view === "week" ? `the week of ${format(from, "MMM d")}` : view === "day" ? `on ${format(anchor, "EEEE, MMM d")}` : `in ${format(anchor, "MMMM")}`;
	return (
		<div
			role="status"
			className={
				block
					? "flex flex-col items-center gap-3 px-6 py-16 text-center"
					: "flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-muted/30 px-3 py-2 sm:px-4"
			}
		>
			<p className="text-[13px] text-muted-foreground">
				{filtered
					? `Nothing ${label} matches your filters.`
					: picks.length
						? `No events from ${picks.length === 1 ? picks[0].name : `the ${picks.length} selected clubs`} ${label}.`
						: `No events ${label}.`}
			</p>
			<div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
				{(filtered || picks.length > 0) && (
					<button type="button" onClick={onClear} className={linkCls}>
						Clear filters
					</button>
				)}
				{!filtered && next && (
					<button type="button" onClick={() => onJump(next.start)} className={linkCls}>
						<span className="shrink-0 text-muted-foreground">Next</span>
						<span className="min-w-0 truncate">{next.title}</span>
						<span className="shrink-0 text-muted-foreground">· {format(next.start, "MMM d")}</span>
					</button>
				)}
			</div>
		</div>
	);
}

/** For you without a signed-in user or without stars. */
function ForYouGate({ status, onSignIn, onAll }) {
	const signedOut = status === "signed-out";
	return (
		<div role="status" className="flex flex-col items-center gap-3 px-6 py-20 text-center">
			<p className="text-[15px] font-medium text-foreground">{signedOut ? "Sign in to see your clubs" : "You haven't starred any clubs yet"}</p>
			<p className="max-w-sm text-sm text-muted-foreground">
				{signedOut
					? "For you shows events from the clubs you star. Everything else is under All campus."
					: "Star clubs you care about and their events show up here."}
			</p>
			<div className="mt-1 flex flex-wrap justify-center gap-2">
				{signedOut ? (
					<button type="button" onClick={onSignIn} className="instinct-btn inline-flex h-8 items-center rounded-full px-4 text-xs font-medium">
						Sign in
					</button>
				) : (
					<Link href="/clubs" className="instinct-btn inline-flex h-8 items-center rounded-full px-4 text-xs font-medium">
						Browse clubs
					</Link>
				)}
				<button type="button" onClick={onAll} className="inline-flex h-8 items-center rounded-full border border-border px-4 text-xs font-medium text-foreground hover:bg-muted">
					See all campus
				</button>
			</div>
		</div>
	);
}

function LoadError({ error, onRetry }) {
	return (
		<div role="alert" className="flex flex-col items-center gap-3 px-6 py-20 text-center">
			<p className="text-[15px] font-medium text-foreground">Couldn't load events</p>
			<p className="max-w-md text-sm text-muted-foreground">The events service didn't respond. Your connection might be offline, or the API is having a moment.</p>
			<button type="button" onClick={onRetry} className="mt-1 inline-flex h-8 items-center rounded-full border border-border px-4 text-xs font-medium text-foreground hover:bg-muted">
				Try again
			</button>
			<p className="mt-2 max-w-md truncate font-mono text-[11px] text-muted-foreground/70">{String(error?.message || error)}</p>
		</div>
	);
}

const VIEWS = [
	{ id: "month", label: "Month", key: "m" },
	{ id: "week", label: "Week", key: "w" },
	{ id: "day", label: "Day", key: "d" },
	{ id: "list", label: "List", key: "l" },
];

function Title({ view, anchor }) {
	if (view === "week") {
		const s = startOfWeek(anchor, WEEK_OPTS);
		const e = endOfWeek(anchor, WEEK_OPTS);
		const left = format(s, "MMM d");
		const right = isSameMonth(s, e) ? format(e, "d") : format(e, "MMM d");
		return (
			<>
				<span className="font-semibold">
					{left} – {right}
				</span>
				<span className="ml-1.5 text-muted-foreground">{format(e, "yyyy")}</span>
			</>
		);
	}
	if (view === "day") {
		return (
			<>
				<span className="font-semibold max-sm:hidden">{format(anchor, "EEEE, MMMM d")}</span>
				<span className="font-semibold sm:hidden">{format(anchor, "EEE, MMM d")}</span>
				<span className="ml-1.5 text-muted-foreground">{format(anchor, "yyyy")}</span>
			</>
		);
	}
	return (
		<>
			<span className="font-semibold">{format(anchor, "MMMM")}</span>
			<span className="ml-1.5 text-muted-foreground">{format(anchor, "yyyy")}</span>
		</>
	);
}

function Segmented({ view, setView }) {
	return (
		<div role="tablist" aria-label="Calendar view" className="inline-flex h-8 items-center rounded-full border border-border bg-background p-[3px] max-sm:w-full">
			{VIEWS.map((v) => (
				<button
					key={v.id}
					type="button"
					role="tab"
					aria-selected={view === v.id}
					onClick={() => setView(v.id)}
					title={`${v.label} (${v.key.toUpperCase()})`}
					className={`h-full rounded-full px-3 text-xs font-medium transition-colors max-sm:flex-1 ${
						view === v.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
					} ${v.id === "week" ? "max-sm:hidden" : ""}`}
				>
					{v.label}
				</button>
			))}
		</div>
	);
}

const toggleIn = (set, id) => {
	const n = new Set(set);
	n.has(id) ? n.delete(id) : n.add(id);
	return n;
};

const VIEW_KEY = "instinct:events-view";
const VIEW_IDS = new Set(["month", "week", "day", "list"]);
function readStoredView() {
	try {
		const v = localStorage.getItem(VIEW_KEY);
		return VIEW_IDS.has(v) ? v : null;
	} catch {
		return null;
	}
}

export default function EventsCalendar({ client, now, initialView = null, initialDate, starred, onSignIn }) {
	// View: ?view= wins, then the last view this browser picked. With neither
	// (a first visit), All campus opens in List (a Week of the whole campus is
	// too dense to read) and For you in Month.
	const [viewPick, setViewPick] = useState(initialView);
	const [storedView] = useState(readStoredView);
	const [anchor, setAnchor] = useState(initialDate || now);
	const [miniMonth, setMiniMonth] = useState(startOfMonth(initialDate || now));
	const isPhone = useIsPhone();
	const [sheetItem, setSheetItem] = useState(null); // kept after close so the exit animation has content
	const [sheetOpen, setSheetOpen] = useState(false);
	const [filtersOpen, setFiltersOpen] = useState(false);
	const filterClubRef = useRef(null);
	const ui = useMemo(
		() => ({
			isMobile: isPhone,
			openSheet: (item) => {
				setSheetItem(item);
				setSheetOpen(true);
			},
			// "Only show this club" from a popover / sheet / Day panel.
			filterClub: (club) => filterClubRef.current?.(club),
		}),
		[isPhone],
	);
	const [openKey, setOpenKey] = useState(null);
	const [selectedId, setSelectedId] = useState(null);

	// Whose events: For you by default only for a signed-in user with stars.
	const [modePick, setModePick] = useState(null);
	const hasStars = starred.status === "ready" && starred.handles.length > 0;
	const mode = modePick ?? (hasStars ? "foryou" : "all");
	const gated = mode === "foryou" && !hasStars;
	const [cats, setCats] = useState(() => new Set());
	const [times, setTimes] = useState(() => new Set());
	const [picks, setPicks] = useState([]);
	const activeCount = cats.size + times.size; // the Filters pill; clubs have their own chips
	const clearFilters = () => {
		setCats(new Set());
		setTimes(new Set());
		setPicks([]);
	};
	const starredSet = useMemo(() => new Set(starred.handles), [starred.handles]);
	// A club outside your stars can't show under For you: picking one switches to All campus.
	const leaveForYouFor = (handle) => {
		if (mode === "foryou" && !starredSet.has(handle)) {
			setModePick("all");
			setViewPick(view); // a filter keeps the view you are on
		}
	};
	const toggleClub = (club) => {
		leaveForYouFor(club.handle);
		setPicks((p) =>
			p.some((x) => x.handle === club.handle) ? p.filter((x) => x.handle !== club.handle) : p.length >= MAX_PICKS ? p : [...p, club],
		);
	};
	filterClubRef.current = (club) => {
		leaveForYouFor(club.handle);
		setPicks([{ handle: club.handle, name: club.name, avatar: club.avatar || null }]);
		setOpenKey(null);
		setSheetOpen(false);
	};

	// Phones have no Week tab; a week request shows the day instead.
	const view = viewPick ?? storedView ?? (mode === "all" ? "list" : "month");
	const v = isPhone && view === "week" ? "day" : view;
	const viewRef = useRef(v);
	viewRef.current = v;

	const [drawFrom, drawTo] = drawRange(v, anchor);
	// Picked clubs go to the server as `clubs=` (For you: picks within your stars).
	const pickHandles = picks.map((p) => p.handle);
	// Until we know whether you're signed in with stars, fetch nothing (avoids
	// an all-campus request that For you would immediately replace).
	const authPending = modePick === null && starred.status === "loading";
	const clubsParam = authPending
		? []
		: mode === "foryou"
			? hasStars
				? picks.length
					? pickHandles.filter((h) => starredSet.has(h))
					: starred.handles
				: []
			: picks.length
				? pickHandles
				: null;
	const data = useCalendarData(client, drawFrom, drawTo, clubsParam);
	const { events, error, retry } = data;
	const loading = data.loading || authPending;

	// Filters run client-side over the cached range: toggling never refetches.
	const base = useMemo(() => {
		const pickSet = picks.length ? new Set(picks.map((p) => p.handle)) : null;
		if (!pickSet && !times.size) return events;
		return events.filter(
			(ev) => (!pickSet || pickSet.has(ev.club?.handle)) && (!times.size || ev.allDay || times.has(timeBucket(ev))),
		);
	}, [events, picks, times]);
	const visible = useMemo(() => (cats.size ? base.filter((ev) => ev.categories.some((c) => cats.has(c))) : base), [base, cats]);
	const index = useMemo(() => buildDayIndex(visible), [visible]);

	const [rangeFrom, rangeTo] = viewRange(v, anchor);
	const rangeKey = `${rangeFrom.getTime()}`;
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the range start
	const counts = useMemo(() => {
		const m = new Map();
		for (const ev of base) {
			if (!(ev.start < rangeTo && ev.end > rangeFrom)) continue;
			for (const c of ev.categories) m.set(c, (m.get(c) || 0) + 1);
		}
		for (const c of cats) if (!m.has(c)) m.set(c, 0);
		return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
	}, [base, rangeKey, v, cats]);
	const busyDays = useMemo(() => new Set(index.keys()), [index]);
	// Empty picker shows the busiest clubs in view.
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the range start
	const busyClubs = useMemo(() => {
		const m = new Map();
		for (const ev of events) {
			if (!ev.club || !(ev.start < rangeTo && ev.end > rangeFrom)) continue;
			const cur = m.get(ev.club.handle);
			if (cur) cur.n++;
			else m.set(ev.club.handle, { n: 1, club: { name: ev.club.name, instagram_handle: ev.club.handle, profile_image_path: ev.club.avatar } });
		}
		return [...m.values()].sort((a, b) => b.n - a.n).map((x) => x.club);
	}, [events, rangeKey, v]);
	// With picks applied the data is only those clubs; keep suggesting from the last unfiltered view.
	const busyRef = useRef([]);
	if (!picks.length && busyClubs.length) busyRef.current = busyClubs;
	const busy = picks.length ? busyRef.current : busyClubs;
	// The picker's club list; live mode fills in once /club-manifest answers.
	const allClubs = useSyncExternalStore(client.subscribe, client.clubs, client.clubs);

	const goTo = (d) => {
		setAnchor(d);
		setMiniMonth(startOfMonth(d));
		setOpenKey(null);
	};
	const step = useCallback((dir) => {
		const cur = viewRef.current;
		setAnchor((a) => {
			const next = cur === "week" ? addWeeks(a, dir) : cur === "day" ? addDays(a, dir) : addMonths(a, dir);
			setMiniMonth(startOfMonth(next));
			return next;
		});
		setOpenKey(null);
	}, []);
	const changeView = (id) => {
		setViewPick(id);
		try {
			localStorage.setItem(VIEW_KEY, id);
		} catch {}
		setOpenKey(null);
	};
	const openDay = (d) => {
		goTo(d);
		changeView("day");
	};

	// Apple-style shortcuts: ←/→ step, T today, M/W/D/L switch view.
	// biome-ignore lint/correctness/useExhaustiveDependencies: handlers read refs/setters only
	useEffect(() => {
		const onKey = (e) => {
			if (e.metaKey || e.ctrlKey || e.altKey) return;
			const t = e.target;
			if (t instanceof HTMLElement && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName))) return;
			if (e.key === "ArrowLeft") step(-1);
			else if (e.key === "ArrowRight") step(1);
			else if (e.key === "t") goTo(new Date());
			else {
				const hit = VIEWS.find((x) => x.key === e.key);
				if (hit) changeView(hit.id);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	// Day view: details panel follows the clicked event, else the day's first from 8 AM.
	const dayEvents = dayList(index, anchor);
	const selectedEvent =
		dayEvents.find((ev) => ev.id === selectedId) ||
		dayEvents.find((ev) => !ev.allDay && ev.start.getHours() >= 8 && isSameDay(ev.start, anchor)) ||
		dayEvents.find((ev) => !ev.allDay) ||
		dayEvents[0] ||
		null;
	const todayInView =
		v === "week"
			? weekDays(anchor).some((d) => isSameDay(d, now))
			: v === "day"
				? isSameDay(anchor, now)
				: isSameMonth(anchor, now) && isSameYear(anchor, now);

	const shared = { index, now, openKey, setOpenKey };
	const gridHeight = "h-[calc(100vh-196px)] min-h-[440px]";
	const emptyProps = { view: v, anchor, events, visible, picks, onClear: clearFilters, onJump: goTo };
	const listEmpty = v === "list" && !visible.some((ev) => ev.start < rangeTo && ev.end > rangeFrom);
	const clubProps = {
		clubs: allClubs,
		busy,
		picks,
		onToggle: toggleClub,
		onRemove: (h) => setPicks((p) => p.filter((x) => x.handle !== h)),
		onClear: () => setPicks([]),
	};
	const panelProps = {
		counts,
		cats,
		toggleCat: (c) => setCats((s) => toggleIn(s, c)),
		times,
		toggleTime: (t) => setTimes((s) => toggleIn(s, t)),
		activeCount,
		onClear: () => {
			setCats(new Set());
			setTimes(new Set());
		},
	};
	const upNext =
		mode === "foryou" && !gated
			? visible
					.filter((ev) => ev.end > now)
					.sort((a, b) => a.start - b.start)
					.slice(0, 4)
			: [];

	let body;
	if (gated) body = <ForYouGate status={starred.status} onSignIn={onSignIn} onAll={() => setModePick("all")} />;
	else if (error && !events.length) body = <LoadError error={error} onRetry={retry} />;
	else {
		body = (
			<>
				{v !== "list" && !loading && <EmptyState {...emptyProps} />}
				{v === "month" && <MonthView anchor={anchor} selectedDate={anchor} onSelectDate={(d) => goTo(d)} onOpenDay={openDay} {...shared} />}
				{v === "week" && <TimeGrid days={weekDays(anchor)} onOpenDay={openDay} className={gridHeight} {...shared} />}
				{v === "day" && isPhone && <TimeGrid days={[anchor]} className="h-[calc(100dvh-250px)] min-h-[420px]" {...shared} />}
				{v === "day" && !isPhone && (
					<div className="flex max-md:flex-col">
						<TimeGrid
							days={[anchor]}
							mode="select"
							selectedId={selectedEvent?.id}
							onSelect={(ev) => setSelectedId(ev.id)}
							className={`min-w-0 flex-1 ${gridHeight} max-md:h-[520px]`}
							{...shared}
						/>
						<aside className="flex w-[300px] shrink-0 flex-col border-border md:border-l max-md:w-full max-md:border-t md:h-[calc(100vh-196px)] md:min-h-[440px]">
							<p className="shrink-0 border-b border-border px-4 py-2.5 text-xs font-medium text-muted-foreground">
								{dayEvents.length} {dayEvents.length === 1 ? "event" : "events"} · {format(anchor, "EEE, MMM d")}
							</p>
							{dayEvents.length > 1 && (
								<ul className="max-h-[38%] shrink-0 overflow-y-auto border-b border-border py-1">
									{dayEvents.map((ev) => (
										<li key={ev.id}>
											<button
												type="button"
												onClick={() => setSelectedId(ev.id)}
												aria-pressed={selectedEvent?.id === ev.id}
												className={`cal-cat-${ev.tone} flex w-full items-center gap-2 px-4 py-1.5 text-left text-xs ${
													selectedEvent?.id === ev.id ? "bg-muted" : "hover:bg-muted/50"
												}`}
											>
												<span className="w-[52px] shrink-0 tabular-nums text-muted-foreground">{ev.allDay ? "All day" : shortTime(ev.start)}</span>
												<span className="cal-dot h-1.5 w-1.5 shrink-0 rounded-full" />
												<span className="min-w-0 truncate font-medium text-foreground">{ev.title}</span>
											</button>
										</li>
									))}
								</ul>
							)}
							<div className="min-h-0 flex-1 overflow-y-auto">
								{selectedEvent ? (
									<EventDetailsBody ev={selectedEvent} />
								) : (
									<p className="px-4 py-10 text-center text-sm text-muted-foreground">{loading ? "Loading…" : "Nothing scheduled."}</p>
								)}
							</div>
						</aside>
					</div>
				)}
				{v === "list" &&
					(listEmpty ? (
						!loading && <EmptyState {...emptyProps} block />
					) : (
						<AgendaView anchor={anchor} className={isPhone ? "h-[calc(100dvh-250px)] min-h-[420px]" : gridHeight} {...shared} />
					))}
			</>
		);
	}

	return (
		<CalendarUI.Provider value={ui}>
			<div className="flex gap-6" data-cal-view={v} data-cal-anchor={dayKey(anchor)} data-cal-loading={loading ? "true" : "false"} data-cal-mode={mode}>
				{/* Sidebar (wide screens) */}
				<aside className="w-[220px] shrink-0 max-lg:hidden">
					<ModeToggle mode={mode} setMode={setModePick} className="mb-4 w-full" />
					<div className="mb-5">
						<ClubSection {...clubProps} />
					</div>
					<MiniMonth month={miniMonth} onMonthChange={setMiniMonth} selected={anchor} now={now} busyDays={busyDays} onSelect={goTo} />
					<div className="mt-5 border-t border-border pt-4">
						<FilterPanel {...panelProps} />
					</div>
					{upNext.length > 0 && (
						<div className="mt-5 border-t border-border pt-4">
							<p className="mb-2 pl-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Up next</p>
							<ul className="space-y-1">
								{upNext.map((ev) => (
									<li key={ev.id}>
										<button
											type="button"
											onClick={() => {
												openDay(ev.start);
												setSelectedId(ev.id);
											}}
											className={`cal-cat-${ev.tone} flex w-full items-start gap-2 rounded-md px-1 py-1.5 text-left hover:bg-muted/60`}
										>
											<span className="cal-dot mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
											<span className="min-w-0">
												<span className="block truncate text-[12.5px] font-medium text-foreground">{ev.title}</span>
												<span className="block text-[11.5px] tabular-nums text-muted-foreground">
													{isSameDay(ev.start, now) ? "Today" : format(ev.start, "EEE, MMM d")}
													{ev.allDay ? "" : ` · ${shortTime(ev.start)}`}
												</span>
											</span>
										</button>
									</li>
								))}
							</ul>
						</div>
					)}
				</aside>

				<div className="min-w-0 flex-1">
					{/* Below lg: mode + a Filters pill that opens the same panel in a sheet */}
					<div className="mb-3 flex items-center gap-2 lg:hidden">
						<ModeToggle mode={mode} setMode={setModePick} />
						<button
							type="button"
							onClick={() => setFiltersOpen(true)}
							className={`ml-auto inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium ${
								activeCount ? "border-foreground/50 bg-muted text-foreground" : "border-border text-foreground hover:bg-muted"
							}`}
						>
							<FiSliders className="h-3.5 w-3.5" aria-hidden />
							Filters
							{activeCount > 0 && <span className="tabular-nums text-muted-foreground">{activeCount}</span>}
						</button>
					</div>
					<div className="mb-3 lg:hidden">
						<ClubSection {...clubProps} />
					</div>

					<div className="overflow-hidden rounded-lg border border-border bg-card">
						{/* Toolbar */}
						<div className="relative flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-border px-3 py-2.5 sm:px-4">
							<h2 className="min-w-0 flex-1 truncate text-[17px] tracking-tight text-foreground sm:text-lg" aria-live="polite">
								<Title view={v} anchor={anchor} />
							</h2>
							<div className="flex items-center gap-1.5">
								<button
									type="button"
									aria-label="Previous"
									onClick={() => step(-1)}
									className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground hover:bg-muted"
								>
									<FiChevronLeft className="h-4 w-4" />
								</button>
								<button
									type="button"
									onClick={() => goTo(now)}
									disabled={todayInView && isSameDay(anchor, now)}
									className="inline-flex h-8 items-center rounded-full border border-border px-3.5 text-xs font-medium text-foreground hover:bg-muted disabled:text-muted-foreground disabled:hover:bg-transparent"
								>
									Today
								</button>
								<button
									type="button"
									aria-label="Next"
									onClick={() => step(1)}
									className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground hover:bg-muted"
								>
									<FiChevronRight className="h-4 w-4" />
								</button>
							</div>
							<div className="max-sm:order-last max-sm:basis-full">
								<Segmented view={v} setView={changeView} />
							</div>
							{loading && !gated && !error && (
								<span className="absolute inset-x-0 -bottom-px h-[2px] animate-pulse bg-[color:var(--accent-brand-solid)]" role="status" aria-label="Loading events" />
							)}
						</div>
						{body}
					</div>
				</div>
			</div>

			{/* Phones: one shared bottom sheet for event details and slot lists */}
			<Sheet open={sheetOpen && isPhone} onOpenChange={setSheetOpen}>
				{sheetItem && (
					<SheetContent aria-describedby={undefined}>
						<SheetTitle className="sr-only">{sheetItem.kind === "slot" ? sheetItem.title : sheetItem.ev.title}</SheetTitle>
						{sheetItem.kind === "slot" ? (
							<SlotList key={sheetItem.title} title={sheetItem.title} subtitle={sheetItem.subtitle} events={sheetItem.events} onClose={() => setSheetOpen(false)} />
						) : (
							<EventDetailsBody ev={sheetItem.ev} onClose={() => setSheetOpen(false)} />
						)}
					</SheetContent>
				)}
			</Sheet>

			{/* Below lg: filters sheet */}
			<Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
				<SheetContent aria-describedby={undefined} className="lg:hidden">
					<div className="flex items-center justify-between px-4 pb-3 pt-1">
						<SheetTitle className="text-[15px] font-semibold tracking-tight text-foreground">Filters</SheetTitle>
						<button
							type="button"
							onClick={() => setFiltersOpen(false)}
							className="inline-flex h-8 items-center rounded-full border border-border px-3.5 text-xs font-medium text-foreground hover:bg-muted"
						>
							Show {visible.filter((ev) => ev.start < rangeTo && ev.end > rangeFrom).length} events
						</button>
					</div>
					<div className="px-4 pb-6">
						<FilterPanel {...panelProps} />
					</div>
				</SheetContent>
			</Sheet>
		</CalendarUI.Provider>
	);
}
