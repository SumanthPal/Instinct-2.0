"use client";

import { Fragment, memo, useEffect, useMemo, useRef, useState } from "react";
import { format, isSameDay, isSameMonth } from "date-fns";
import { FiChevronDown } from "react-icons/fi";
import { EventPopover, SlotPopover } from "./EventDetails";
import { TONES, dayKey, dayList, eventsInDays, layoutSpans, monthGrid, shortTime, shortTitle, timeRange } from "./calendar-utils";

const SLOT = 18;
const GAP = 3;
const HEAD = 26;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function TimedChip({ ev }) {
	return (
		<span className={`cal-cat-${ev.tone} cal-chip @container flex h-full w-full items-center gap-1 rounded-[4px] pl-1.5 pr-1 text-left text-[11px] leading-none text-foreground`}>
			<span className="min-w-0 flex-1 truncate font-medium">{shortTitle(ev.title)}</span>
			<span className="hidden shrink-0 tabular-nums text-muted-foreground @min-[112px]:inline">{shortTime(ev.start)}</span>
		</span>
	);
}

function SpanChip({ sp }) {
	return (
		<span
			className={`cal-cat-${sp.ev.tone} cal-chip-solid flex h-full w-full items-center px-1.5 text-left text-[11px] font-medium leading-none text-foreground ${
				sp.cutLeft ? "rounded-l-none" : "rounded-l-[4px]"
			} ${sp.cutRight ? "rounded-r-none" : "rounded-r-[4px]"}`}
		>
			<span className="truncate">{shortTitle(sp.ev.title)}</span>
		</span>
	);
}

/** One dot per colour present (max 4). */
function CategoryDots({ list }) {
	const present = new Set(list.map((ev) => ev.tone));
	return (
		<span className="flex shrink-0 gap-[3px]" aria-hidden>
			{TONES.filter((t) => present.has(t)).map((t) => (
				<span key={t} className={`cal-cat-${t} cal-dot h-1.5 w-1.5 rounded-full`} />
			))}
		</span>
	);
}

/**
 * Lays one week row out: multi-day bars in lanes, then timed chips. A day
 * whose events don't fit switches to a summary ("14 events" + dots) that
 * opens the day, instead of a column of chips plus "+N more".
 */
function layoutWeek(index, days, maxSlots) {
	const laid = layoutSpans(eventsInDays(index, days), days, { splitOngoing: true });
	let spans = laid.spans;
	// Long spans share one "Ongoing (N)" bar in the top lane, across the days they cover.
	if (laid.ongoing.length) {
		const first = days[0].getTime();
		const col = (d) => Math.round((d.getTime() - first) / 86_400_000);
		let start = days.length - 1;
		let end = 0;
		for (const ev of laid.ongoing) {
			start = Math.min(start, Math.max(0, col(ev.start)));
			end = Math.max(end, Math.min(days.length - 1, col(ev.end) - 1));
		}
		spans = [{ ongoing: laid.ongoing, start, end: Math.max(start, end), lane: 0 }, ...spans.map((sp) => ({ ...sp, lane: sp.lane + 1 }))];
	}
	const perDay = days.map((day, c) => {
		const list = dayList(index, day);
		const taken = new Set(spans.filter((sp) => sp.start <= c && sp.end >= c).map((sp) => sp.lane));
		const timed = list.filter((ev) => !ev.allDay);
		const summary = taken.size + timed.length > maxSlots;
		return { list, timed, taken, summary, limit: summary ? maxSlots - 1 : maxSlots };
	});
	const shownSpans = spans.filter((sp) => {
		for (let c = sp.start; c <= sp.end; c++) if (sp.lane >= perDay[c].limit) return false;
		return true;
	});
	for (const [c, d] of perDay.entries()) {
		const used = new Set(shownSpans.filter((sp) => sp.start <= c && sp.end >= c).map((sp) => sp.lane));
		if (d.summary) {
			let row = 0;
			while (used.has(row)) row++;
			d.summaryRow = row;
			d.placed = [];
		} else {
			d.placed = [];
			let slot = 0;
			for (const ev of d.timed) {
				while (used.has(slot)) slot++;
				d.placed.push({ ev, slot });
				slot++;
			}
		}
	}
	return { shownSpans, perDay };
}

const WeekRow = memo(function WeekRow({ days, first, anchor, index, now, maxSlots, onOpenDay, openKey, setOpenKey }) {
	// biome-ignore lint/correctness/useExhaustiveDependencies: days are keyed by the first day
	const { shownSpans, perDay } = useMemo(() => layoutWeek(index, days, maxSlots), [index, dayKey(days[0]), maxSlots]);
	const wk = dayKey(days[0]);

	return (
		<div className="relative grid min-h-0 grid-cols-7">
			{days.map((day, c) => {
				const inMonth = isSameMonth(day, anchor);
				return (
					<div
						key={dayKey(day)}
						className={`border-border p-1 ${c ? "border-l" : ""} ${first ? "" : "border-t"} ${inMonth ? "" : "bg-muted/30"}`}
					>
						<div className="flex justify-end">
							<button
								type="button"
								onClick={() => onOpenDay(day)}
								aria-label={`Open ${format(day, "EEEE, MMMM d")}`}
								className="rounded-full hover:bg-muted"
							>
								<DayNumber day={day} now={now} muted={!inMonth} />
							</button>
						</div>
					</div>
				);
			})}
			<div
				className="pointer-events-none absolute inset-x-0 bottom-0 grid grid-cols-7 overflow-hidden"
				style={{ top: HEAD + 4, gridAutoRows: `${SLOT}px`, rowGap: GAP }}
			>
				{shownSpans.map((sp) => {
					if (sp.ongoing) {
						const key = `mo-${wk}`;
						return (
							<div
								key={key}
								className="pointer-events-auto min-w-0 px-1"
								style={{ gridColumn: `${sp.start + 1} / ${sp.end + 2}`, gridRow: 1 }}
							>
								<SlotPopover
									slot={{
										subtitle: `Week of ${format(days[0], "MMM d")}`,
										title: `Ongoing · ${sp.ongoing.length} multi-day ${sp.ongoing.length === 1 ? "event" : "events"}`,
										events: sp.ongoing,
									}}
									instanceKey={key}
									openKey={openKey}
									setOpenKey={setOpenKey}
									side="bottom"
								>
									<button
										type="button"
										data-ongoing
										className="flex h-full w-full min-w-0 items-center gap-1.5 rounded-[4px] border border-border px-1.5 text-left text-[11px] leading-none hover:bg-muted data-[state=open]:border-foreground/40"
									>
										<span className="shrink-0 font-medium text-foreground">Ongoing</span>
										<span className="shrink-0 tabular-nums text-muted-foreground">({sp.ongoing.length})</span>
										<span className="min-w-0 truncate text-muted-foreground">· {sp.ongoing.map((ev) => shortTitle(ev.title)).join(", ")}</span>
										<FiChevronDown className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
									</button>
								</SlotPopover>
							</div>
						);
					}
					const key = `ms-${sp.ev.id}-${wk}`;
					return (
						<div
							key={key}
							className={`pointer-events-auto min-w-0 ${sp.cutLeft ? "pl-0" : "pl-1"} ${sp.cutRight ? "pr-0" : "pr-1"}`}
							style={{ gridColumn: `${sp.start + 1} / ${sp.end + 2}`, gridRow: sp.lane + 1 }}
						>
							<EventPopover ev={sp.ev} instanceKey={key} openKey={openKey} setOpenKey={setOpenKey}>
								<button type="button" className="block h-full w-full" aria-label={`${sp.ev.title}, ${timeRange(sp.ev)}`}>
									<SpanChip sp={sp} />
								</button>
							</EventPopover>
						</div>
					);
				})}
				{perDay.map(({ placed, summary, summaryRow, list }, c) => (
					<Fragment key={dayKey(days[c])}>
						{placed.map(({ ev, slot }) => {
							const key = `mt-${ev.id}-${dayKey(days[c])}`;
							return (
								<div key={key} className="pointer-events-auto min-w-0 px-1" style={{ gridColumn: c + 1, gridRow: slot + 1 }}>
									<EventPopover ev={ev} instanceKey={key} openKey={openKey} setOpenKey={setOpenKey}>
										<button
											type="button"
											className={`block h-full w-full ${isSameMonth(days[c], anchor) ? "" : "opacity-60"}`}
											aria-label={`${ev.title}, ${timeRange(ev)}`}
										>
											<TimedChip ev={ev} />
										</button>
									</EventPopover>
								</div>
							);
						})}
						{summary && (
							<div className="pointer-events-auto min-w-0 px-1" style={{ gridColumn: c + 1, gridRow: summaryRow + 1 }}>
								<button
									type="button"
									onClick={() => onOpenDay(days[c])}
									aria-label={`${list.length} events on ${format(days[c], "EEEE, MMMM d")}. Open day`}
									className={`@container flex h-full w-full items-center gap-1.5 rounded-[4px] border border-border px-1.5 text-left text-[11px] leading-none hover:bg-muted ${
										isSameMonth(days[c], anchor) ? "" : "opacity-60"
									}`}
								>
									<span className="min-w-0 truncate font-medium tabular-nums text-foreground">
										{list.length}
										<span className="font-normal text-muted-foreground"> events</span>
									</span>
									<span className="ml-auto hidden @min-[84px]:flex">
										<CategoryDots list={list} />
									</span>
								</button>
							</div>
						)}
					</Fragment>
				))}
			</div>
		</div>
	);
});

function DayNumber({ day, now, muted }) {
	const today = now && isSameDay(day, now);
	return (
		<span
			className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs tabular-nums ${
				today ? "cal-today-dot font-semibold" : muted ? "text-muted-foreground/60" : "text-foreground"
			}`}
		>
			{day.getDate() === 1 && !today ? format(day, "MMM d") : day.getDate()}
		</span>
	);
}

export default function MonthView({ anchor, index, now, selectedDate, onSelectDate, onOpenDay, openKey, setOpenKey }) {
	const days = monthGrid(anchor);
	const rows = days.length / 7;
	const selectedEvents = dayList(index, selectedDate);
	const bodyRef = useRef(null);
	const [maxSlots, setMaxSlots] = useState(3);

	// Fit as many chips per cell as the row height allows (Apple-style).
	useEffect(() => {
		const el = bodyRef.current;
		if (!el) return;
		const measure = () => {
			const rowH = el.clientHeight / rows;
			setMaxSlots(Math.max(1, Math.floor((rowH - HEAD - 4 + GAP) / (SLOT + GAP))));
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	}, [rows]);

	return (
		<div className="flex flex-col">
			<div className="grid grid-cols-7 border-b border-border">
				{WEEKDAYS.map((d) => (
					<div key={d} className="px-2 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground max-sm:text-center">
						<span className="sm:hidden">{d[0]}</span>
						<span className="max-sm:hidden">{d}</span>
					</div>
				))}
			</div>

			{/* Desktop / tablet: chips and multi-day bars, one grid per week row */}
			<div
				ref={bodyRef}
				className="grid h-[calc(100vh-226px)] min-h-[520px] max-sm:hidden"
				style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
			>
				{Array.from({ length: rows }, (_, r) => (
					<WeekRow
						key={dayKey(days[r * 7])}
						days={days.slice(r * 7, r * 7 + 7)}
						first={r === 0}
						anchor={anchor}
						index={index}
						now={now}
						maxSlots={maxSlots}
						onOpenDay={onOpenDay}
						openKey={openKey}
						setOpenKey={setOpenKey}
					/>
				))}
			</div>

			{/* Phone: dots in cells, selected day's events listed underneath */}
			<div className="sm:hidden">
				<div className="grid grid-cols-7">
					{days.map((day, i) => {
						const list = dayList(index, day);
						const inMonth = isSameMonth(day, anchor);
						const today = now && isSameDay(day, now);
						const selected = isSameDay(day, selectedDate);
						return (
							<button
								type="button"
								key={dayKey(day)}
								onClick={() => onSelectDate(day)}
								className={`flex h-12 flex-col items-center justify-start gap-1 border-border pt-1.5 ${i >= 7 ? "border-t" : ""}`}
								aria-label={`${format(day, "EEEE, MMMM d")}, ${list.length} events`}
								aria-pressed={selected}
							>
								<span
									className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[13px] tabular-nums ${
										today
											? "cal-today-dot font-semibold"
											: selected
												? "bg-foreground font-semibold text-background"
												: inMonth
													? "text-foreground"
													: "text-muted-foreground/50"
									}`}
								>
									{day.getDate()}
								</span>
								{list.length > 3 ? (
									<span className={`text-[9.5px] font-medium leading-none tabular-nums ${inMonth ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
										{list.length}
									</span>
								) : (
									<span className="flex h-1 gap-[3px]">
										{list.map((ev) => (
											<span key={ev.id} className={`cal-cat-${ev.tone} cal-dot h-1 w-1 rounded-full`} />
										))}
									</span>
								)}
							</button>
						);
					})}
				</div>
				<div className="border-t border-border">
					<p className="px-4 pb-1 pt-3 text-xs font-medium text-muted-foreground">
						{format(selectedDate, "EEEE, MMMM d")}
					</p>
					{selectedEvents.length === 0 ? (
						<p className="px-4 pb-4 pt-1 text-sm text-muted-foreground">No events.</p>
					) : (
						<ul className="pb-2">
							{selectedEvents.map((ev) => {
								const key = `mm-${ev.id}`;
								return (
									<li key={key}>
										<EventPopover ev={ev} instanceKey={key} openKey={openKey} setOpenKey={setOpenKey} side="top">
											<button type="button" className={`cal-cat-${ev.tone} flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/60`}>
												<span className="cal-bar h-8 w-[3px] shrink-0 rounded-full" />
												<span className="min-w-0 flex-1">
													<span className="block truncate text-sm font-medium text-foreground">{ev.title}</span>
													<span className="block truncate text-xs text-muted-foreground">
														{ev.club?.name}
													</span>
												</span>
												<span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
													{ev.allDay ? "All day" : shortTime(ev.start)}
												</span>
											</button>
										</EventPopover>
									</li>
								);
							})}
						</ul>
					)}
				</div>
			</div>
		</div>
	);
}
