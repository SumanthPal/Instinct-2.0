"use client";

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { addDays, format, isSameDay, startOfMonth } from "date-fns";
import ClubAvatar from "@/components/ClubAvatar";
import { EventPopover } from "./EventDetails";
import { dayKey, dayList, shortTime } from "./calendar-utils";

const HEAD = 36; // day header row
const ROW = 56; // event row
const OVERSCAN = 480; // px rendered above/below the viewport

/** Flat rows with precomputed offsets: [{ kind, day, ev?, y, h }]. */
function buildRows(index, anchor) {
	const rows = [];
	const first = startOfMonth(anchor);
	let y = 0;
	for (let d = first; d.getMonth() === first.getMonth(); d = addDays(d, 1)) {
		const list = dayList(index, d);
		if (!list.length) continue;
		const head = { kind: "day", day: d, count: list.length, y, h: HEAD };
		head.head = head;
		rows.push(head);
		y += HEAD;
		for (const ev of list) {
			rows.push({ kind: "ev", day: d, ev, y, h: ROW, head });
			y += ROW;
		}
	}
	return { rows, total: y };
}

/** Index of the last row starting at or above `y`. */
function rowAt(rows, y) {
	let lo = 0;
	let hi = rows.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (rows[mid].y <= y) lo = mid;
		else hi = mid - 1;
	}
	return lo;
}

function DayHeader({ day, count, now }) {
	const today = now && isSameDay(day, now);
	return (
		<div className="flex h-full items-center gap-2 border-b border-border bg-card px-4 sm:pl-5">
			<span
				className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[13px] font-semibold tabular-nums ${
					today ? "cal-today-dot" : "text-foreground"
				}`}
			>
				{day.getDate()}
			</span>
			<span className="text-[13px] font-medium text-foreground">{format(day, "EEEE")}</span>
			<span className="text-xs text-muted-foreground">{today ? "Today" : format(day, "MMMM")}</span>
			<span className="ml-auto text-xs tabular-nums text-muted-foreground">
				{count} {count === 1 ? "event" : "events"}
			</span>
		</div>
	);
}

const EventRow = memo(function EventRow({ ev, day, openKey, setOpenKey }) {
	const key = `ag-${ev.id}-${dayKey(day)}`;
	return (
		<EventPopover ev={ev} instanceKey={key} openKey={openKey} setOpenKey={setOpenKey} side="bottom">
			<button
				type="button"
				className={`cal-cat-${ev.tone} flex h-full w-full items-center gap-3 px-4 text-left hover:bg-muted/60 sm:pl-5`}
			>
				<span className="w-[60px] shrink-0 text-xs leading-4 tabular-nums text-muted-foreground">
					{ev.allDay ? (
						"All day"
					) : (
						<>
							<span className="block text-foreground">{shortTime(ev.start)}</span>
							<span className="block">{shortTime(ev.end)}</span>
						</>
					)}
				</span>
				<span className="cal-bar h-8 w-[3px] shrink-0 rounded-full" />
				<span className="min-w-0 flex-1">
					<span className="block truncate text-sm font-medium text-foreground">{ev.title}</span>
					<span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
						{ev.club && (
							<span className="relative h-4 w-4 shrink-0 overflow-hidden rounded-full">
								<ClubAvatar src={ev.club.avatar} alt="" sizes="16px" />
							</span>
						)}
						<span className="min-w-0 truncate">
							{ev.club?.name}
							{ev.location ? ` · ${ev.location}` : ""}
						</span>
					</span>
				</span>
			</button>
		</EventPopover>
	);
});

/**
 * Month agenda, windowed: only rows within the viewport ± OVERSCAN are in
 * the DOM (fixed row heights, prefix offsets, binary search). A pinned copy
 * of the current day's header sits on top and is pushed up by the next one.
 */
export default function AgendaView({ anchor, index, now, openKey, setOpenKey, className = "" }) {
	const monthKey = format(anchor, "yyyy-MM");
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed on month
	const { rows, total } = useMemo(() => buildRows(index, anchor), [index, monthKey]);
	const ref = useRef(null);
	const [top, setTop] = useState(0);
	const [height, setHeight] = useState(800);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		let raf = 0;
		const onScroll = () => {
			if (raf) return;
			raf = requestAnimationFrame(() => {
				raf = 0;
				setTop(el.scrollTop);
			});
		};
		const ro = new ResizeObserver(() => setHeight(el.clientHeight));
		ro.observe(el);
		el.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			el.removeEventListener("scroll", onScroll);
			ro.disconnect();
			cancelAnimationFrame(raf);
		};
	}, []);

	// Start at today when it's in this month, else at the top.
	// biome-ignore lint/correctness/useExhaustiveDependencies: once per month
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		const today = now && rows.find((r) => r.kind === "day" && (isSameDay(r.day, now) || r.day > now));
		el.scrollTop = today && today.day.getMonth() === anchor.getMonth() ? today.y : 0;
		setTop(el.scrollTop);
	}, [monthKey]);

	if (!rows.length) return null;

	const from = rowAt(rows, Math.max(0, top - OVERSCAN));
	const visible = [];
	for (let i = from; i < rows.length && rows[i].y < top + height + OVERSCAN; i++) visible.push(rows[i]);

	// Pinned header: the day whose section contains the top edge.
	const cur = rows[rowAt(rows, top)];
	let pinned = null;
	let push = 0;
	if (cur && top > 0) {
		const next = rows.find((r) => r.kind === "day" && r.y > top);
		pinned = cur.head;
		if (next) push = Math.min(0, next.y - top - HEAD);
	}

	return (
		<div className={`relative ${className}`}>
			<div ref={ref} className="h-full overflow-y-auto overscroll-contain" data-agenda-scroller="">
				<div className="relative" style={{ height: total }}>
					{visible.map((r) =>
						r.kind === "day" ? (
							<div key={`d-${dayKey(r.day)}`} className="absolute inset-x-0" style={{ top: r.y, height: r.h }}>
								<DayHeader day={r.day} count={r.count} now={now} />
							</div>
						) : (
							<div key={`e-${r.ev.id}-${dayKey(r.day)}`} className="absolute inset-x-0" style={{ top: r.y, height: r.h }} data-agenda-row="">
								<EventRow ev={r.ev} day={r.day} openKey={openKey} setOpenKey={setOpenKey} />
							</div>
						),
					)}
				</div>
			</div>
			{pinned && (
				<div className="pointer-events-none absolute inset-x-0 top-0 z-10 overflow-hidden" style={{ height: HEAD }} aria-hidden>
					<div style={{ height: HEAD, transform: `translateY(${push}px)` }}>
						<DayHeader day={pinned.day} count={pinned.count} now={now} />
					</div>
				</div>
			)}
		</div>
	);
}
