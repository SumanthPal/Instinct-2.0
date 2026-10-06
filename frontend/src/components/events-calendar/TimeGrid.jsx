"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FiArrowDown, FiArrowUp } from "react-icons/fi";
import { addHours, differenceInMinutes, format, isSameDay, setHours, startOfDay } from "date-fns";
import { EventPopover, SlotPopover } from "./EventDetails";
import {
	DAY_START_HOUR,
	dayKey,
	dayList,
	eventsInDays,
	layoutDay,
	layoutSpans,
	shortTime,
	slotEvents,
	timeRange,
	visibleHours,
} from "./calendar-utils";

const HOUR = 42; // px per hour
const PAD = 8; // room above the first hour so its label isn't clipped
const px = (mins) => (mins * HOUR) / 60;
const MAX_COLS = 3; // side-by-side blocks per overlap group; the rest go behind "+N"
const MIN_BLOCK = 38; // px: narrower than this a block can't show a word, so use fewer columns

function hourLabel(h) {
	return format(setHours(startOfDay(new Date(2000, 0, 1)), h), "h a");
}

function Block({ item, selected }) {
	const { ev, height } = item;
	const h = px(height);
	const tier = h < 34 ? 0 : h < 60 ? 1 : h < 84 ? 2 : 3;
	return (
		<span
			data-selected={selected ? "true" : undefined}
			className={`cal-cat-${ev.tone} cal-block @container flex h-full w-full flex-col overflow-hidden rounded-[5px] px-1.5 text-left @max-[66px]:pl-1 @max-[66px]:pr-0.5 ${
				tier ? "py-[3px]" : "justify-center"
			}`}
		>
			<span
				className={`text-[11.5px] font-medium leading-[14px] text-foreground hyphens-auto break-words @max-[60px]:[overflow-wrap:normal] @max-[60px]:text-[10.5px] @max-[60px]:leading-[13px] ${
					tier >= 2 ? "line-clamp-2 @max-[63px]:[-webkit-line-clamp:var(--lines)]" : tier === 1 ? "truncate @max-[63px]:line-clamp-2 @max-[63px]:whitespace-normal" : "truncate"
				}`}
				style={{ "--lines": Math.max(2, Math.floor((h - 6) / 14)) }}
			>
				{ev.title}
				{tier === 0 && <span className="ml-1 hidden font-normal text-muted-foreground @min-[96px]:inline">{shortTime(ev.start)}</span>}
			</span>
			{tier >= 1 && (
				<span className="mt-px hidden truncate text-[11px] leading-[14px] text-muted-foreground tabular-nums @min-[64px]:block">{timeRange(ev)}</span>
			)}
			{tier >= 3 && ev.location && (
				<span className="hidden truncate text-[11px] leading-[14px] text-muted-foreground @min-[64px]:block">{ev.location}</span>
			)}
		</span>
	);
}

/** One day's blocks and "+N" pills; memoized so scroll/offscreen updates skip it. */
const DayColumn = memo(function DayColumn({ d, laid, list, strip, multi, mode, onSelect, selectedId, openKey, setOpenKey }) {
	const wrap = (ev, key, node) =>
		mode === "select" ? (
			<button type="button" key={key} onClick={() => onSelect(ev)} className="block h-full w-full" aria-label={`${ev.title}, ${timeRange(ev)}`}>
				{node}
			</button>
		) : (
			<EventPopover key={key} ev={ev} instanceKey={key} openKey={openKey} setOpenKey={setOpenKey} side={multi ? "right" : "left"}>
				<button type="button" className="block h-full w-full" aria-label={`${ev.title}, ${timeRange(ev)}`}>
					{node}
				</button>
			</EventPopover>
		);
	return (
		<>
		{laid.blocks.map((item) => {
			const key = `tg-${item.ev.id}-${dayKey(d)}`;
			const R = item.reserve ? strip : 0;
			return (
				<div
					key={key}
					className={`@container absolute pr-[2px] ${item.col ? "cal-overlap" : ""}`}
					style={{
						top: PAD + px(item.top) + 1,
						height: Math.max(px(item.height) - 2, 18),
						left: `calc((100% - ${R}px) * ${item.col / item.cols} + 2px)`,
						width: `calc((100% - ${R}px) * ${item.span / item.cols} - 2px)`,
						zIndex: 1 + item.col,
					}}
				>
					{wrap(item.ev, key, <Block item={item} selected={selectedId === item.ev.id} />)}
				</div>
			);
		})}
		{laid.more.map((m) => {
			const key = `more-${dayKey(d)}-${m.hour}`;
			const from = setHours(startOfDay(d), m.hour);
			const inSlot = slotEvents(list, d, m.hour);
			const slot = {
				subtitle: format(d, "EEE, MMM d"),
				title: `${shortTime(from)} – ${shortTime(addHours(from, 1))} · ${inSlot.length} events`,
				events: inSlot,
			};
			return (
				<SlotPopover
					key={key}
					slot={slot}
					instanceKey={key}
					openKey={openKey}
					setOpenKey={setOpenKey}
					onPick={mode === "select" ? onSelect : undefined}
					side={multi ? "right" : "left"}
				>
					<button
						type="button"
						aria-label={`${m.hidden.length} more events around ${shortTime(from)}`}
						className="absolute z-[8] inline-flex h-5 items-center justify-center rounded-full border border-border bg-card text-[10.5px] font-medium tabular-nums text-foreground hover:bg-muted data-[state=open]:border-foreground/40"
						style={{ top: PAD + px(m.at) + 1, right: 2, width: strip - 4 }}
					>
						+{m.hidden.length}
						{!multi && <span className="ml-1 font-normal text-muted-foreground">more</span>}
					</button>
				</SlotPopover>
			);
		})}
		</>
	);
});

// Last fitted column cap per day count, so a remount starts with the right layout.
const fittedCols = {};

/**
 * Week (7 columns) or Day (1 column) time grid. Header and all-day row are
 * sticky inside the same scroller so columns always line up.
 * mode="popover": click opens details. mode="select": click calls onSelect.
 */
export default function TimeGrid({
	days,
	index,
	now,
	onOpenDay,
	openKey,
	setOpenKey,
	mode = "popover",
	selectedId,
	onSelect,
	className = "",
}) {
	const cols = `56px repeat(${days.length}, minmax(0, 1fr))`;
	const dayKeys = days.map(dayKey).join(",");
	const firstDay = dayKey(days[0]);
	const strip = days.length > 1 ? 26 : 72; // px kept free for "+N" in crowded groups
	const scroller = useRef(null);
	// Up to 3 columns, fewer when the day column is too narrow to read them.
	const [maxCols, setMaxCols] = useState(() => fittedCols[days.length] ?? MAX_COLS);
	useLayoutEffect(() => {
		const el = scroller.current;
		if (!el) return;
		const fit = () => {
			const col = (el.clientWidth - 56) / days.length;
			const n = Math.max(1, Math.min(MAX_COLS, Math.floor((col - strip) / MIN_BLOCK)));
			fittedCols[days.length] = n;
			setMaxCols(n);
		};
		fit();
		const ro = new ResizeObserver(fit);
		ro.observe(el);
		return () => ro.disconnect();
	}, [days.length, strip]);
	// Layout is the expensive part at campus scale: once per data/range change.
	// biome-ignore lint/correctness/useExhaustiveDependencies: days are keyed by dayKeys
	const layout = useMemo(() => {
		const all = eventsInDays(index, days);
		// 8 AM–10 PM by default, stretched so early/late events keep real heights.
		const { startHour, endHour } = visibleHours(all, days);
		const laid = days.map((d) => {
			const res = layoutDay(dayList(index, d), d, startHour, endHour, maxCols);
			// Keep "+N" pills at least a pill apart when hours are crowded.
			let prev = Number.NEGATIVE_INFINITY;
			for (const m of res.more) {
				m.at = Math.max(m.first, prev + 32);
				prev = m.at;
			}
			return res;
		});
		return { startHour, endHour, ...layoutSpans(all, days), laid, flat: laid.flatMap((l) => l.blocks) };
	}, [index, dayKeys, maxCols]);
	const { startHour, endHour, spans, lanes, laid, flat } = layout;

	const HOURS = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
	const nowMins = now ? differenceInMinutes(now, setHours(startOfDay(now), startHour)) : -1;
	const nowVisible = nowMins >= 0 && nowMins <= (endHour - startHour) * 60;
	const gridHeight = px((endHour - startHour) * 60) + PAD * 2;
	const [offscreen, setOffscreen] = useState({ above: [], below: [] });

	// "2 earlier" / "1 later" pills when blocks are scrolled out of view.
	// biome-ignore lint/correctness/useExhaustiveDependencies: flat is derived from events/days
	const measure = useCallback(() => {
		const el = scroller.current;
		if (!el) return;
		const header = el.firstElementChild?.offsetHeight || 0;
		const viewBottom = el.scrollTop + el.clientHeight - header;
		const above = flat.filter((it) => PAD + px(it.top + it.height) <= el.scrollTop + 2);
		const below = flat.filter((it) => PAD + px(it.top) >= viewBottom - 2);
		setOffscreen((o) =>
			o.above.length === above.length && o.below.length === below.length ? o : { above, below },
		);
	}, [layout]);

	const reveal = (it) => {
		const el = scroller.current;
		if (!el) return;
		const header = el.firstElementChild?.offsetHeight || 0;
		const target = PAD + px(it.top) - 16;
		el.scrollTo({ top: it === offscreen.below[0] ? target - (el.clientHeight - header) / 2 : target, behavior: "smooth" });
	};

	// Open scrolled near "now" (or the first event) instead of always at 8 AM.
	// biome-ignore lint/correctness/useExhaustiveDependencies: only re-scroll when the range changes
	useEffect(() => {
		const el = scroller.current;
		if (!el) return;
		// Open at 8 AM (or the first event after it); earlier events are a
		// scroll up. If that would hide "now", slide down to it.
		const showsToday = now && days.some((d) => isSameDay(d, now));
		const header = el.firstElementChild?.offsetHeight || 0;
		const viewMins = ((el.clientHeight - header) / HOUR) * 60;
		const eight = (DAY_START_HOUR - startHour) * 60;
		const later = flat
			.map((it) => it.top)
			.filter((t) => t >= eight);
		let mins = later.length ? Math.max(eight, Math.min(...later) - 20) : eight;
		if (showsToday && nowVisible && nowMins > mins + viewMins - 45) mins = nowMins - viewMins + 90;
		el.scrollTop = Math.max(0, px(mins));
		measure();
	}, [firstDay, days.length, startHour]);

	useEffect(() => {
		measure();
	}, [measure]);

	const wrap = (ev, key, node) =>
		mode === "select" ? (
			<button type="button" key={key} onClick={() => onSelect(ev)} className="block h-full w-full" aria-label={`${ev.title}, ${timeRange(ev)}`}>
				{node}
			</button>
		) : (
			<EventPopover key={key} ev={ev} instanceKey={key} openKey={openKey} setOpenKey={setOpenKey} side={days.length > 1 ? "right" : "left"}>
				<button type="button" className="block h-full w-full" aria-label={`${ev.title}, ${timeRange(ev)}`}>
					{node}
				</button>
			</EventPopover>
		);

	return (
		<div ref={scroller} onScroll={measure} className={`relative overflow-y-auto overscroll-contain ${className}`}>
			{/* Sticky header: weekday + date, then all-day row */}
			<div className="sticky top-0 z-20 border-b border-border bg-card">
				<div className="grid" style={{ gridTemplateColumns: cols }}>
					<div />
					{days.map((d) => {
						const today = now && isSameDay(d, now);
						return (
							<button
								type="button"
								key={dayKey(d)}
								onClick={() => onOpenDay?.(d)}
								disabled={!onOpenDay}
								className="flex items-center justify-center gap-1.5 border-l border-border py-2 text-xs enabled:hover:bg-muted/50"
							>
								<span className={today ? "font-medium text-foreground" : "text-muted-foreground"}>{format(d, "EEE")}</span>
								<span
									className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 tabular-nums ${
										today ? "cal-today-dot font-semibold" : "text-foreground"
									}`}
								>
									{d.getDate()}
								</span>
							</button>
						);
					})}
				</div>
				<div className="relative grid border-t border-border" style={{ gridTemplateColumns: cols, height: Math.max(lanes, 1) * 23 + 5 }}>
					<div className="flex items-start justify-end pr-2 pt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
						all-day
					</div>
					{days.map((d) => (
						<div key={dayKey(d)} className="border-l border-border" />
					))}
					<div
						className="absolute inset-y-0 left-[56px] right-0 grid py-[3px]"
						style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`, gridAutoRows: "20px", rowGap: 3 }}
					>
						{spans.map((sp) => {
							const key = `ad-${sp.ev.id}-${dayKey(days[0])}`;
							const sel = selectedId === sp.ev.id;
							const node = (
								<span
									className={`cal-cat-${sp.ev.tone} cal-chip-solid flex h-[20px] items-center px-1.5 text-[11px] font-medium text-foreground ${
										sp.cutLeft ? "" : "rounded-l-[4px]"
									} ${sp.cutRight ? "" : "rounded-r-[4px]"} ${sel ? "ring-1 ring-inset ring-foreground/40" : ""}`}
								>
									<span className="truncate">{sp.ev.title}</span>
								</span>
							);
							return (
								<div
									key={key}
									className={`min-w-0 ${sp.cutLeft ? "" : "pl-[3px]"} ${sp.cutRight ? "" : "pr-[3px]"}`}
									style={{ gridColumn: `${sp.start + 1} / ${sp.end + 2}`, gridRow: sp.lane + 1 }}
								>
									{wrap(sp.ev, key, node)}
								</div>
							);
						})}
					</div>
				</div>
				{offscreen.above.length > 0 && (
					<button
						type="button"
						onClick={() => reveal(offscreen.above[offscreen.above.length - 1])}
						aria-label={`${offscreen.above.length} earlier ${offscreen.above.length === 1 ? "event" : "events"}`}
						title="Earlier events"
						className="absolute left-1.5 top-full mt-3.5 inline-flex h-6 items-center gap-1 rounded-full border border-border bg-card px-2 text-[11px] font-medium tabular-nums text-foreground hover:bg-muted"
					>
						<FiArrowUp className="h-3 w-3" aria-hidden />
						{offscreen.above.length}
					</button>
				)}
			</div>

			{/* Time grid */}
			<div className="relative grid" style={{ gridTemplateColumns: cols, height: gridHeight }}>
				{/* Gutter labels */}
				<div className="relative">
					{HOURS.map((h, i) => (
						<span
							key={h}
							className="absolute right-2 -translate-y-1/2 text-[10.5px] tabular-nums text-muted-foreground"
							style={{ top: PAD + i * HOUR }}
						>
							{hourLabel(h)}
						</span>
					))}
					{nowVisible && days.some((d) => isSameDay(d, now)) && (
						<span
							className="cal-now-text absolute right-1.5 z-10 -translate-y-1/2 bg-card px-0.5 text-[10.5px] font-semibold tabular-nums"
							style={{ top: PAD + px(nowMins) }}
						>
							{format(now, "h:mm")}
						</span>
					)}
				</div>

				{/* Hour lines across all columns */}
				<div className="pointer-events-none absolute inset-y-0 left-[56px] right-0">
					{HOURS.map((h, i) => (
						<div key={h} className="absolute inset-x-0 border-t border-border/70" style={{ top: PAD + i * HOUR }} />
					))}
				</div>

				{days.map((d, di) => {
					const today = now && isSameDay(d, now);
					return (
						<div key={dayKey(d)} className={`relative border-l border-border ${today ? "bg-muted/25" : ""}`}>
							<DayColumn
								d={d}
								laid={laid[di]}
								list={dayList(index, d)}
								strip={strip}
								multi={days.length > 1}
								mode={mode}
								onSelect={onSelect}
								selectedId={selectedId}
								openKey={openKey?.includes(dayKey(d)) ? openKey : null}
								setOpenKey={setOpenKey}
							/>
							{today && nowVisible && (
								<div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: PAD + px(nowMins) }}>
									<div className="cal-now relative h-[1.5px] w-full">
										<span className="cal-now absolute -left-[4px] -top-[3.5px] h-2 w-2 rounded-full" />
									</div>
								</div>
							)}
						</div>
					);
				})}
			</div>
			{offscreen.below.length > 0 && (
				<div className="pointer-events-none sticky bottom-0 z-20 h-0">
					<button
						type="button"
						onClick={() => reveal(offscreen.below[0])}
						aria-label={`${offscreen.below.length} later ${offscreen.below.length === 1 ? "event" : "events"}`}
						title="Later events"
						className="pointer-events-auto absolute bottom-1.5 left-1.5 inline-flex h-6 items-center gap-1 rounded-full border border-border bg-card px-2 text-[11px] font-medium tabular-nums text-foreground hover:bg-muted"
					>
						<FiArrowDown className="h-3 w-3" aria-hidden />
						{offscreen.below.length}
					</button>
				</div>
			)}
		</div>
	);
}
