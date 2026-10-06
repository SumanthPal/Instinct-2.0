"use client";

import { createContext, useContext, useState } from "react";
import Link from "next/link";
import { Slot } from "@radix-ui/react-slot";
import { format } from "date-fns";
import { FiCalendar, FiChevronLeft, FiClock, FiDownload, FiFilter, FiMapPin, FiX } from "react-icons/fi";
import ClubAvatar from "@/components/ClubAvatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { icsHref, shortTime, timeRange } from "./calendar-utils";

/**
 * isMobile: details open in one shared bottom sheet instead of popovers.
 * openSheet({ kind: "event", ev }) | openSheet({ kind: "slot", title, subtitle, events })
 */
export const CalendarUI = createContext({ isMobile: false, openSheet: () => {}, filterClub: null });


/** Body shared by the popover and the Day view side panel. */
export function EventDetailsBody({ ev, onClose }) {
	const { filterClub } = useContext(CalendarUI);
	const mapsHref = ev.location
		? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${ev.location} UC Irvine`)}`
		: null;
	return (
		<div className={`cal-cat-${ev.tone} flex flex-col`}>
			<div className="flex items-start gap-3 px-4 pt-4">
				<span className="cal-bar mt-1 h-4 w-1 shrink-0 rounded-full" aria-hidden />
				<div className="min-w-0 flex-1">
					<p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
						{ev.categories.length ? ev.categories.join(" · ") : "Club event"}
					</p>
					<h3 className="mt-0.5 text-[15px] font-semibold leading-snug tracking-tight text-foreground [overflow-wrap:anywhere]">
						{ev.title}
					</h3>
				</div>
				{onClose && (
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
					>
						<FiX className="h-4 w-4" />
					</button>
				)}
			</div>

			<dl className="mt-3 space-y-2 px-4 text-[13px]">
				<div className="flex items-center gap-2.5 text-foreground">
					<FiCalendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
					<dt className="sr-only">Date</dt>
					<dd>{format(ev.start, "EEEE, MMMM d")}</dd>
				</div>
				<div className="flex items-center gap-2.5 text-foreground">
					<FiClock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
					<dt className="sr-only">Time</dt>
					<dd>{timeRange(ev)}</dd>
				</div>
				{ev.location && (
					<div className="flex items-center gap-2.5">
						<FiMapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
						<dt className="sr-only">Location</dt>
						<dd className="min-w-0">
							<a
								href={mapsHref}
								target="_blank"
								rel="noopener noreferrer"
								className="text-foreground underline decoration-border underline-offset-4 [overflow-wrap:anywhere] hover:decoration-foreground"
							>
								{ev.location}
							</a>
						</dd>
					</div>
				)}
			</dl>

			{ev.details && (
				<p className="mt-3 px-4 text-[13px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{ev.details}</p>
			)}

			{ev.club && (
				<Link
					href={`/club/${ev.club.handle}`}
					className="mx-4 mt-4 flex items-center gap-3 rounded-md border border-border px-3 py-2.5 hover:border-foreground/25"
				>
					<span className="instinct-story-ring shrink-0" style={{ padding: 2 }}>
						<span className="instinct-story-ring-inner" style={{ padding: 1.5 }}>
							<span className="relative block h-8 w-8 overflow-hidden rounded-full">
								<ClubAvatar src={ev.club.avatar} alt={ev.club.name} sizes="32px" ring={false} />
							</span>
						</span>
					</span>
					<span className="min-w-0 flex-1">
						<span className="block truncate text-[13px] font-medium text-foreground">{ev.club.name}</span>
						<span className="block truncate text-xs text-muted-foreground">@{ev.club.handle}</span>
					</span>
					<span className="shrink-0 text-xs text-muted-foreground">View club</span>
				</Link>
			)}
			{ev.club && filterClub && (
				<button
					type="button"
					onClick={() => filterClub(ev.club)}
					className="mx-4 mt-2 inline-flex h-7 items-center gap-1.5 self-start rounded-full px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
				>
					<FiFilter className="h-3 w-3" aria-hidden />
					Only show this club
				</button>
			)}

			<div className="flex items-center gap-2 px-4 pb-4 pt-3">
				<a
					href={icsHref(ev)}
					download={`${ev.title.replace(/[^\w]+/g, "-").toLowerCase()}.ics`}
					className="instinct-btn inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium"
				>
					<FiDownload className="h-3.5 w-3.5" aria-hidden />
					Add to calendar
				</a>
				{mapsHref && (
					<a
						href={mapsHref}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex h-8 items-center rounded-full border border-border px-3.5 text-xs font-medium text-foreground hover:bg-muted"
					>
						Directions
					</a>
				)}
			</div>
		</div>
	);
}

/**
 * Wraps a trigger (chip, block, row) in a popover. Controlled by the parent
 * so only one is open at a time across the whole calendar.
 */
export function EventPopover({ ev, instanceKey, openKey, setOpenKey, side = "right", children }) {
	const { isMobile, openSheet } = useContext(CalendarUI);
	const open = openKey === instanceKey;
	if (isMobile) {
		return (
			<Slot aria-haspopup="dialog" onClick={() => openSheet({ kind: "event", ev })}>
				{children}
			</Slot>
		);
	}
	// Hundreds of triggers on a busy week: only the open one mounts a Radix
	// Popover; the rest are plain buttons.
	if (!open) {
		return (
			<Slot aria-haspopup="dialog" aria-expanded={false} onClick={() => setOpenKey(instanceKey)}>
				{children}
			</Slot>
		);
	}
	return (
		<Popover open onOpenChange={(o) => setOpenKey(o ? instanceKey : null)}>
			<PopoverTrigger asChild>{children}</PopoverTrigger>
			<PopoverContent side={side} align="start" sideOffset={8} collisionPadding={12} className="w-[320px] max-w-[calc(100vw-24px)]">
				<EventDetailsBody ev={ev} onClose={() => setOpenKey(null)} />
			</PopoverContent>
		</Popover>
	);
}

/**
 * Everything in one time slot ("+N more" in Week/Day). Rows drill into the
 * event's details in place, or call onPick (Day view selects into its panel).
 */
export function SlotList({ title, subtitle, events, onPick, onClose }) {
	const [sel, setSel] = useState(null);
	if (sel) {
		return (
			<div>
				<button
					type="button"
					onClick={() => setSel(null)}
					className="ml-2 mt-2 inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
				>
					<FiChevronLeft className="h-3.5 w-3.5" aria-hidden />
					{events.length} events
				</button>
				<div className="-mt-2">
					<EventDetailsBody ev={sel} onClose={onClose} />
				</div>
			</div>
		);
	}
	return (
		<div className="flex max-h-[min(440px,70dvh)] flex-col">
			<div className="flex shrink-0 items-start gap-3 border-b border-border px-4 pb-2.5 pt-3.5">
				<div className="min-w-0 flex-1">
					<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{subtitle}</p>
					<h3 className="mt-0.5 text-[15px] font-semibold tracking-tight text-foreground">{title}</h3>
				</div>
				{onClose && (
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						className="-mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
					>
						<FiX className="h-4 w-4" />
					</button>
				)}
			</div>
			<ul className="min-h-0 overflow-y-auto overscroll-contain py-1">
				{events.map((ev) => (
					<li key={ev.id}>
						<button
							type="button"
							onClick={() => (onPick ? onPick(ev) : setSel(ev))}
							className={`cal-cat-${ev.tone} flex w-full items-center gap-2.5 px-4 py-1.5 text-left hover:bg-muted/60`}
						>
							<span className="w-[50px] shrink-0 text-xs tabular-nums text-muted-foreground">{shortTime(ev.start)}</span>
							<span className="cal-bar h-7 w-[3px] shrink-0 rounded-full" />
							<span className="min-w-0 flex-1">
								<span className="block truncate text-[13px] font-medium text-foreground">{ev.title}</span>
								<span className="block truncate text-[11.5px] text-muted-foreground">{ev.club?.name}</span>
							</span>
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}

/** Popover (desktop) or shared sheet (phone) holding a SlotList. */
export function SlotPopover({ slot, instanceKey, openKey, setOpenKey, onPick, side = "right", children }) {
	const { isMobile, openSheet } = useContext(CalendarUI);
	const open = openKey === instanceKey;
	if (isMobile) {
		return (
			<Slot aria-haspopup="dialog" onClick={() => openSheet({ kind: "slot", ...slot })}>
				{children}
			</Slot>
		);
	}
	if (!open) {
		return (
			<Slot aria-haspopup="dialog" aria-expanded={false} onClick={() => setOpenKey(instanceKey)}>
				{children}
			</Slot>
		);
	}
	return (
		<Popover open onOpenChange={(o) => setOpenKey(o ? instanceKey : null)}>
			<PopoverTrigger asChild>{children}</PopoverTrigger>
			<PopoverContent side={side} align="start" sideOffset={6} collisionPadding={12} className="w-[320px] max-w-[calc(100vw-24px)]">
				<SlotList
					{...slot}
					onClose={() => setOpenKey(null)}
					onPick={
						onPick &&
						((ev) => {
							onPick(ev);
							setOpenKey(null);
						})
					}
				/>
			</PopoverContent>
		</Popover>
	);
}
