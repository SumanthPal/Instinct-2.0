"use client";

import { useState } from "react";
import { startOfMonth } from "date-fns";
import { FiCalendar, FiChevronDown, FiChevronRight } from "react-icons/fi";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { EventDetailsBody } from "@/components/events-calendar/EventDetails";
import MiniMonth from "@/components/events-calendar/MiniMonth";
import { buildDayIndex, dayList } from "@/components/events-calendar/calendar-utils";
import { groupByMonth, metaLine, relLabel } from "./format";
import {
	DateBlock,
	EmptyNote,
	EventsSkeleton,
	FullCalendarLink,
	NextUpCard,
	SubscribeLink,
	btnGhost,
	btnOutline,
	useIsPhone,
} from "./parts";

const UPCOMING_LIMIT = 8;
const PAST_LIMIT = 5;

function Row({ ev, now, onOpen, muted, flash }) {
	const rel = muted ? null : relLabel(ev, now);
	return (
		<li id={`club-ev-${ev.id}`}>
			<button
				type="button"
				onClick={() => onOpen(ev)}
				aria-haspopup="dialog"
				data-club-event-row=""
				className={`group -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/60 ${flash ? "bg-muted" : ""}`}
			>
				<DateBlock ev={ev} now={now} muted={muted} />
				<span className="min-w-0 flex-1">
					<span className={`line-clamp-2 text-sm font-medium [overflow-wrap:anywhere] ${muted ? "text-foreground/75" : "text-foreground"}`}>
						{ev.title}
						{rel && <span className="instinct-text ml-2 whitespace-nowrap text-[11px] font-medium">{rel}</span>}
					</span>
					<span className="mt-0.5 block truncate text-xs tabular-nums text-muted-foreground">{metaLine(ev)}</span>
				</span>
				<FiChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
			</button>
		</li>
	);
}

function Grouped({ list, now, onOpen, muted, flashId }) {
	return groupByMonth(list, now).map((g) => (
		<div key={g.key}>
			<p className="pb-1 pt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{g.label}</p>
			<ul>
				{g.events.map((ev) => (
					<Row key={ev.id} ev={ev} now={now} onOpen={onOpen} muted={muted} flash={flashId === ev.id} />
				))}
			</ul>
		</div>
	));
}

function MoreButton({ open, onClick, children }) {
	return (
		<button type="button" onClick={onClick} aria-expanded={open} className={`${btnGhost} mt-2`}>
			{open ? "Show fewer" : children}
			<FiChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
		</button>
	);
}

/** Event details: the calendar's EventDetailsBody in a dialog (desktop) or bottom sheet (phone). */
function EventDetailsModal({ ev, open, onOpenChange, isPhone, onViewPost }) {
	const body = ev && (
		<EventDetailsBody ev={ev} onClose={() => onOpenChange(false)} showClub={false} onViewPost={onViewPost} />
	);
	if (isPhone) {
		return (
			<Sheet open={open} onOpenChange={onOpenChange}>
				{ev && (
					<SheetContent aria-describedby={undefined} data-club-event-details="sheet">
						<SheetTitle className="sr-only">{ev.title}</SheetTitle>
						{body}
					</SheetContent>
				)}
			</Sheet>
		);
	}
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{ev && (
				<DialogContent aria-describedby={undefined} data-club-event-details="dialog">
					<DialogTitle className="sr-only">{ev.title}</DialogTitle>
					{body}
				</DialogContent>
			)}
		</Dialog>
	);
}

/**
 * Club page Events tab (#115): a "Next up" card for the soonest upcoming
 * event, then the rest of Upcoming and Past as compact rows grouped by
 * month, with a MiniMonth beside them (a toggle on phones) that jumps to a
 * day's events. Data: useClubEvents (one GET /events?clubs=<handle>).
 * `canViewPost(postId)` / `onViewPost(postId)` hand off to the post viewer.
 */
export default function ClubEventsTab({ club, data, calendarUrl, canViewPost, onViewPost }) {
	const { status, events, upcoming, past, now, retry } = data;
	const isPhone = useIsPhone();
	const [openEv, setOpenEv] = useState(null); // kept after close for the exit animation
	const [detailsOpen, setDetailsOpen] = useState(false);
	const [moreUp, setMoreUp] = useState(false);
	const [morePast, setMorePast] = useState(false);
	const [monthOpen, setMonthOpen] = useState(false);
	const [month, setMonth] = useState(null);
	const [picked, setPicked] = useState(null);
	const [flashId, setFlashId] = useState(null);
	const handle = club?.instagram_handle || "";

	const openEvent = (ev) => {
		setOpenEv(ev);
		setDetailsOpen(true);
	};
	const viewPost =
		openEv?.postId && canViewPost?.(openEv.postId)
			? () => {
					setDetailsOpen(false);
					onViewPost(openEv.postId);
				}
			: null;

	let body;
	if (status === "idle" || (status === "loading" && !events.length)) body = <EventsSkeleton />;
	else if (status === "error" && !events.length) {
		body = (
			<div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border px-4 py-3">
				<p className="text-[13px] text-muted-foreground">Couldn&apos;t load events right now.</p>
				<button type="button" onClick={retry} className={btnOutline}>
					Try again
				</button>
			</div>
		);
	} else if (!events.length) {
		body = <EmptyNote kind="none" club={club} now={now} calendarUrl={calendarUrl} />;
	} else {
		const index = buildDayIndex(events);
		const busyDays = new Set(index.keys());
		const [next, ...rest] = upcoming;
		const shownUp = moreUp ? rest : rest.slice(0, UPCOMING_LIMIT);
		const shownPast = morePast ? past : past.slice(0, PAST_LIMIT);
		const shownMonth = month || startOfMonth(next?.start || past[0]?.start || now);

		// MiniMonth: jump to (and briefly highlight) the first event on that day.
		const jumpTo = (day) => {
			setPicked(day);
			const ev = dayList(index, day)[0];
			if (!ev) return;
			if (rest.indexOf(ev) >= UPCOMING_LIMIT) setMoreUp(true);
			if (past.indexOf(ev) >= PAST_LIMIT) setMorePast(true);
			setFlashId(ev.id);
			setTimeout(() => document.getElementById(`club-ev-${ev.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 30);
			setTimeout(() => setFlashId((id) => (id === ev.id ? null : id)), 1600);
		};
		const mini = <MiniMonth month={shownMonth} onMonthChange={setMonth} selected={picked} now={now} busyDays={busyDays} onSelect={jumpTo} />;

		body = (
			<div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_208px]">
				<div className="min-w-0">
					<section aria-labelledby="club-events-upcoming">
						<div className="flex min-h-8 items-center gap-2">
							<h3 id="club-events-upcoming" className="text-sm font-semibold tracking-tight text-foreground">
								Upcoming
								{upcoming.length > 0 && <span className="ml-1.5 font-normal tabular-nums text-muted-foreground">{upcoming.length}</span>}
							</h3>
							<div className="ml-auto flex items-center gap-1">
								<button
									type="button"
									onClick={() => setMonthOpen((o) => !o)}
									aria-expanded={monthOpen}
									className={`${btnOutline} md:hidden ${monthOpen ? "bg-muted" : ""}`}
								>
									<FiCalendar className="h-3.5 w-3.5" aria-hidden />
									Month
								</button>
								<SubscribeLink calendarUrl={calendarUrl} className="md:hidden" />
								<FullCalendarLink handle={handle} className="max-md:hidden" />
							</div>
						</div>
						{monthOpen && <div className="mt-3 rounded-lg border border-border p-3 md:hidden">{mini}</div>}
						{next ? (
							<>
								<div className="mt-3">
									<NextUpCard ev={next} now={now} onOpen={openEvent} flash={flashId === next.id} />
								</div>
								<Grouped list={shownUp} now={now} onOpen={openEvent} flashId={flashId} />
								{rest.length > UPCOMING_LIMIT && (
									<MoreButton open={moreUp} onClick={() => setMoreUp((m) => !m)}>
										Show {rest.length - UPCOMING_LIMIT} more upcoming
									</MoreButton>
								)}
							</>
						) : (
							<EmptyNote kind="upcoming" club={club} last={past[0]} now={now} calendarUrl={calendarUrl} onOpen={openEvent} className="mt-3" />
						)}
					</section>

					{past.length > 0 && (
						<section aria-labelledby="club-events-past" className="mt-8 border-t border-border pt-6">
							<h3 id="club-events-past" className="text-sm font-semibold tracking-tight text-foreground">
								Past
								<span className="ml-1.5 font-normal tabular-nums text-muted-foreground">{past.length}</span>
							</h3>
							<Grouped list={shownPast} now={now} onOpen={openEvent} muted flashId={flashId} />
							{past.length > PAST_LIMIT && (
								<MoreButton open={morePast} onClick={() => setMorePast((m) => !m)}>
									Show all {past.length} past events
								</MoreButton>
							)}
						</section>
					)}
					<div className="mt-6 md:hidden">
						<FullCalendarLink handle={handle} className="-ml-2" />
					</div>
				</div>

				<aside className="max-md:hidden">
					<div className="sticky top-24 space-y-5">
						{mini}
						{calendarUrl && (
							<div className="border-t border-border pt-4">
								<p className="text-[13px] font-medium text-foreground">Never miss one</p>
								<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
									Subscribe and {club?.name || "this club"}&apos;s events show up in your calendar app.
								</p>
								<div className="mt-3 flex flex-wrap items-center gap-1.5">
									<SubscribeLink calendarUrl={calendarUrl} />
									<a href={calendarUrl} className={btnGhost}>
										Download .ics
									</a>
								</div>
							</div>
						)}
					</div>
				</aside>
			</div>
		);
	}

	return (
		<div className="px-4 py-6 sm:px-0" data-club-events-status={status}>
			{body}
			<EventDetailsModal ev={openEv} open={detailsOpen} onOpenChange={setDetailsOpen} isPhone={isPhone} onViewPost={viewPost} />
		</div>
	);
}
