"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { addDays, format, isSameMonth, isSameYear, startOfDay } from "date-fns";
import { FiArrowUpRight, FiCalendar, FiDownload, FiMapPin, FiRss } from "react-icons/fi";
import { icsHref } from "@/components/events-calendar/calendar-utils";
import { isMultiDay, lastDay, relLabel, whenLine } from "./format";

const PHONE = "(max-width: 639px)";

/** Phone layout (bottom sheet instead of a dialog). False until mounted. */
export function useIsPhone() {
	const [phone, setPhone] = useState(false);
	useEffect(() => {
		const mq = window.matchMedia(PHONE);
		const on = () => setPhone(mq.matches);
		on();
		mq.addEventListener("change", on);
		return () => mq.removeEventListener("change", on);
	}, []);
	return phone;
}

export const btnOutline =
	"inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-muted";
export const btnGhost =
	"inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground";

/** The club's existing calendar.ics feed as a webcal: subscribe link. */
export function SubscribeLink({ calendarUrl, label = "Subscribe", className = "" }) {
	if (!calendarUrl) return null;
	return (
		<a
			href={calendarUrl.replace(/^https?:/, "webcal:")}
			className={`${btnOutline} ${className}`}
			title="Add this club's events to Apple, Google, or Outlook Calendar"
		>
			<FiRss className="h-3.5 w-3.5" aria-hidden />
			{label}
		</a>
	);
}

export function FullCalendarLink({ handle, className = "" }) {
	return (
		<Link href={`/events?club=${encodeURIComponent(handle)}`} className={`${btnGhost} ${className}`}>
			Full calendar
			<FiArrowUpRight className="h-3.5 w-3.5" aria-hidden />
		</Link>
	);
}

/** Bordered date tile: month over day ("OCT / 15", "OCT / 24–25"). */
export function DateBlock({ ev, now, muted = false }) {
	const end = lastDay(ev);
	const span = isMultiDay(ev) && isSameMonth(ev.start, end) ? `${ev.start.getDate()}–${end.getDate()}` : null;
	// Accent only for today's and in-progress events.
	const live = !muted && now && ev.start < addDays(startOfDay(now), 1) && ev.endMs > now.getTime();
	return (
		<span
			className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md border bg-card leading-none ${
				live ? "border-[color:var(--accent-brand)]" : "border-border"
			}`}
		>
			<span className={`text-[9.5px] font-semibold uppercase tracking-wider ${live ? "instinct-text" : "text-muted-foreground"}`}>
				{format(ev.start, "MMM")}
			</span>
			<span
				className={`mt-1 font-semibold tabular-nums tracking-tight ${span ? "text-[12px]" : "text-[16px]"} ${
					muted ? "text-muted-foreground" : "text-foreground"
				}`}
			>
				{span || ev.start.getDate()}
			</span>
		</span>
	);
}

/**
 * Square poster slot of a fixed size. A plain date tile is always drawn;
 * the post image sits on top, transparent until it has loaded, and is
 * dropped if it fails (most pre-Oct 5 R2 images 404). No broken-image
 * icon, no flash, no layout change either way.
 */
function Poster({ ev, src, big = false }) {
	const [state, setState] = useState("loading");
	return (
		<span className="relative block h-full w-full overflow-hidden bg-muted" data-poster={src ? state : "none"}>
			<span className="absolute inset-0 flex flex-col items-center justify-center leading-none" aria-hidden>
				<span className={`${big ? "text-xs" : "text-[10px]"} font-semibold uppercase tracking-wider text-muted-foreground`}>
					{format(ev.start, "MMM")}
				</span>
				<span className={`${big ? "mt-2 text-4xl" : "mt-1 text-xl"} font-semibold tabular-nums tracking-tight text-foreground`}>
					{ev.start.getDate()}
				</span>
			</span>
			{src && state !== "error" && (
				<Image
					src={src}
					alt=""
					fill
					unoptimized
					sizes={big ? "160px" : "72px"}
					className={`object-cover transition-opacity duration-150 ${state === "loaded" ? "opacity-100" : "opacity-0"}`}
					onLoad={() => setState("loaded")}
					onError={() => setState("error")}
				/>
			)}
		</span>
	);
}

/** The next upcoming event: poster, when/where, Add to calendar, Details. */
export function NextUpCard({ ev, now, onOpen, flash }) {
	const rel = relLabel(ev, now);
	return (
		<article
			id={`club-ev-${ev.id}`}
			data-club-next-up=""
			className={`overflow-hidden rounded-lg border bg-card transition-colors sm:grid sm:grid-cols-[160px_minmax(0,1fr)] ${
				flash ? "border-[color:var(--accent-brand)]" : "border-border"
			}`}
		>
			<button type="button" onClick={() => onOpen(ev)} aria-label={`Open ${ev.title}`} className="block h-full min-h-[160px] border-r border-border max-sm:hidden">
				<Poster key={ev.postImage || "none"} ev={ev} src={ev.postImage} big />
			</button>
			<div className="flex min-w-0 flex-col p-4">
				<div className="flex gap-3">
					<button type="button" onClick={() => onOpen(ev)} aria-label={`Open ${ev.title}`} className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-md sm:hidden">
						<Poster key={ev.postImage || "none"} ev={ev} src={ev.postImage} />
					</button>
					<div className="min-w-0">
						<p className="text-[11px] font-semibold uppercase tracking-wider">
							<span className="instinct-text">Next up</span>
							{rel && <span className="text-muted-foreground"> · {rel}</span>}
						</p>
						<button type="button" onClick={() => onOpen(ev)} aria-haspopup="dialog" className="mt-1 block text-left">
							<h4 className="line-clamp-2 text-[16px] font-semibold leading-snug tracking-tight text-foreground [overflow-wrap:anywhere] hover:underline hover:decoration-border hover:underline-offset-4">
								{ev.title}
							</h4>
						</button>
						<p className="mt-1.5 flex items-start gap-2 text-[13px] tabular-nums text-foreground">
							<FiCalendar className="mt-[3px] h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
							<span className="min-w-0">{whenLine(ev, now)}</span>
						</p>
						{ev.location && (
							<p className="mt-1 flex items-center gap-2 text-[13px] text-foreground">
								<FiMapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
								<span className="min-w-0 truncate">{ev.location}</span>
							</p>
						)}
					</div>
				</div>
				{ev.details && <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{ev.details}</p>}
				<div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
					<a
						href={icsHref(ev)}
						download={`${ev.title.replace(/[^\w]+/g, "-").toLowerCase()}.ics`}
						className="instinct-btn inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium"
					>
						<FiDownload className="h-3.5 w-3.5" aria-hidden />
						Add to calendar
					</a>
					<button type="button" onClick={() => onOpen(ev)} aria-haspopup="dialog" className={btnOutline}>
						Details
					</button>
				</div>
			</div>
		</article>
	);
}

/** Left-aligned empty state: no events at all, or nothing upcoming. */
export function EmptyNote({ kind, club, last, now, calendarUrl, onOpen, className = "" }) {
	const name = club?.name || "This club";
	return (
		<div role="status" className={`rounded-lg border border-border px-4 py-4 sm:px-5 ${className}`} data-club-events-empty={kind}>
			<p className="text-sm font-medium text-foreground">{kind === "none" ? "No events yet" : "Nothing coming up"}</p>
			<p className="mt-1 max-w-[52ch] text-[13px] leading-relaxed text-muted-foreground">
				{kind === "none" ? (
					<>Events show up here when {name} announces them on Instagram. Subscribe and new ones land in your calendar.</>
				) : (
					<>
						{name} hasn&apos;t announced anything new.
						{last && (
							<>
								{" "}
								The last event was{" "}
								<button
									type="button"
									onClick={() => onOpen?.(last)}
									className="text-foreground underline decoration-border underline-offset-4 [overflow-wrap:anywhere] hover:decoration-foreground"
								>
									{last.title}
								</button>{" "}
								on {format(last.start, isSameYear(last.start, now) ? "MMM d" : "MMM d, yyyy")}.
							</>
						)}
					</>
				)}
			</p>
			<div className="mt-3 flex flex-wrap items-center gap-2">
				<SubscribeLink calendarUrl={calendarUrl} label="Subscribe to new events" />
				<Link href="/events" className={btnGhost}>
					Browse campus events
					<FiArrowUpRight className="h-3.5 w-3.5" aria-hidden />
				</Link>
			</div>
		</div>
	);
}

/** Placeholder while the request is in flight: a card and a few rows. */
export function EventsSkeleton() {
	const bar = "animate-pulse rounded bg-muted";
	return (
		<div role="status" aria-busy="true" data-club-events-loading="">
			<span className="sr-only">Loading events</span>
			<div className={`h-4 w-24 ${bar}`} />
			<div className="mt-4 h-[118px] animate-pulse rounded-lg border border-border bg-muted/40 sm:h-[160px]" />
			<div className="mt-6 space-y-4">
				{[0, 1, 2].map((i) => (
					<div key={i} className="flex items-center gap-3">
						<div className="h-11 w-11 animate-pulse rounded-md bg-muted" />
						<div className="flex-1 space-y-2">
							<div className={`h-3 w-1/2 ${bar}`} />
							<div className={`h-3 w-1/3 ${bar}`} />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
