"use client";

import { format, isSameDay, isToday, isTomorrow } from "date-fns";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FiArrowRight, FiCalendar, FiCompass, FiDownload, FiImage, FiMapPin, FiSearch, FiStar } from "react-icons/fi";
import ClubAvatar from "@/components/ClubAvatar";
import ClubCard from "@/components/ClubCard";
import { icsHref, shortTitle, timeRange } from "@/components/events-calendar/calendar-utils";
import { resolveClubImageUrl } from "@/lib/club-image";

export function SectionHeader({ title, count, href, action = "View all" }) {
	return (
		<div className="mb-3 flex items-baseline justify-between gap-3">
			<h2 className="text-sm font-semibold tracking-tight text-foreground">
				{title}
				{count != null && <span className="ml-1.5 font-normal text-muted-foreground">{count}</span>}
			</h2>
			{href && (
				<Link href={href} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
					{action} <FiArrowRight className="h-3 w-3" aria-hidden />
				</Link>
			)}
		</div>
	);
}

export function dayLabel(d) {
	if (isToday(d)) return "Today";
	if (isTomorrow(d)) return "Tomorrow";
	return format(d, "EEE, MMM d");
}

export function AddToCal({ ev, label = false }) {
	return (
		<a
			href={icsHref(ev)}
			download={`${ev.title.slice(0, 40).replace(/[^\w]+/g, "-")}.ics`}
			onClick={(e) => e.stopPropagation()}
			aria-label="Add to calendar"
			title="Add to calendar"
			className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-border px-2 text-xs text-muted-foreground hover:border-primary/60 hover:text-foreground"
		>
			<FiDownload className="h-3.5 w-3.5" aria-hidden />
			{label && <span>Add to calendar</span>}
		</a>
	);
}

export function Avatar({ src, size = 20 }) {
	return (
		<span className="relative inline-block shrink-0 overflow-hidden rounded-full" style={{ width: size, height: size }}>
			<ClubAvatar src={resolveClubImageUrl(src)} sizes={`${size}px`} />
		</span>
	);
}

export function EventRow({ ev, showDate = false }) {
	return (
		<li className="group flex items-start gap-3 px-3 py-2.5 hover:bg-muted/40">
			<div className="w-[68px] shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
				{showDate && <div className="font-medium text-foreground">{format(ev.start, "EEE d")}</div>}
				{ev.allDay ? "All day" : format(ev.start, "h:mm a")}
			</div>
			<Link href={`/club/${ev.club?.handle}?tab=events`} className="min-w-0 flex-1">
				<div className="truncate text-sm font-medium text-foreground group-hover:text-primary">{shortTitle(ev.title)}</div>
				<div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
					<Avatar src={ev.avatar} size={14} />
					<span className="truncate">{ev.club?.name}</span>
					{ev.location && (
						<>
							<span aria-hidden>·</span>
							<FiMapPin className="h-3 w-3 shrink-0" aria-hidden />
							<span className="truncate">{ev.location}</span>
						</>
					)}
				</div>
			</Link>
			<AddToCal ev={ev} />
		</li>
	);
}

/** Upcoming events grouped by day, capped with a show-all toggle. */
export function GroupedEvents({ events, cap = 8 }) {
	const [all, setAll] = useState(false);
	const groups = useMemo(() => {
		const out = [];
		for (const ev of all ? events : events.slice(0, cap)) {
			const last = out[out.length - 1];
			if (last && isSameDay(last.day, ev.start)) last.items.push(ev);
			else out.push({ day: ev.start, items: [ev] });
		}
		return out;
	}, [events, all, cap]);
	if (!events.length)
		return (
			<div className="rounded-lg border border-border px-4 py-6 text-sm text-muted-foreground">
				Nothing from your clubs in the next two weeks.{" "}
				<Link href="/events" className="text-primary hover:underline">
					See all campus events
				</Link>
			</div>
		);
	return (
		<div className="overflow-hidden rounded-lg border border-border">
			{groups.map((g) => (
				<div key={g.day.toISOString()} className="border-b border-border last:border-b-0">
					<div className="flex items-center justify-between bg-muted/30 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
						<span className={isToday(g.day) ? "text-primary" : ""}>{dayLabel(g.day)}</span>
						<span>{g.items.length}</span>
					</div>
					<ul className="divide-y divide-border">
						{g.items.map((ev) => (
							<EventRow key={ev.id} ev={ev} />
						))}
					</ul>
				</div>
			))}
			{events.length > cap && (
				<button
					type="button"
					onClick={() => setAll((v) => !v)}
					className="w-full border-t border-border px-3 py-2 text-left text-xs text-muted-foreground hover:text-foreground"
				>
					{all ? "Show less" : `Show ${events.length - cap} more`}
				</button>
			)}
		</div>
	);
}

/** Square post thumbnail; hides a dead image instead of flashing a broken icon. */
export function PostTile({ post }) {
	const [ok, setOk] = useState(true);
	const h = post.club?.instagram;
	return (
		<Link
			href={`/club/${h}?post=${post.id}`}
			className="group relative block aspect-square overflow-hidden rounded-md border border-border bg-muted/40"
		>
			{ok ? (
				// biome-ignore lint/performance/noImgElement: R2 thumbnails, hidden on error
				<img src={post.image_url} alt={post.caption?.slice(0, 80) || ""} loading="lazy" onError={() => setOk(false)} className="h-full w-full object-cover" />
			) : (
				<div className="flex h-full items-center justify-center text-muted-foreground">
					<FiImage className="h-5 w-5" aria-hidden />
				</div>
			)}
			<div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 border-t border-border bg-background/90 px-2 py-1 text-[11px] text-foreground">
				<Avatar src={post.club?.profilePicture} size={14} />
				<span className="truncate">{post.club?.name}</span>
				{post.posted && <span className="ml-auto shrink-0 text-muted-foreground">{format(new Date(post.posted), "MMM d")}</span>}
			</div>
		</Link>
	);
}

export function PostGrid({ posts, cols = "grid-cols-2 sm:grid-cols-3", limit = 6 }) {
	if (!posts?.length) return <div className="rounded-lg border border-border px-4 py-6 text-sm text-muted-foreground">No recent posts.</div>;
	return (
		<div className={`grid gap-2 ${cols}`}>
			{posts.slice(0, limit).map((p) => (
				<PostTile key={p.id} post={p} />
			))}
		</div>
	);
}

export function ClubsGrid({ clubs, onUnstar }) {
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{clubs.map((club, index) => (
				<div key={club.id || club.instagram} className="h-full">
					<ClubCard club={club} index={index} onLikeChange={onUnstar && ((liked) => !liked && onUnstar(club.instagram))} />
				</div>
			))}
		</div>
	);
}

export function Skeleton({ className = "h-40" }) {
	return <div className={`animate-pulse rounded-lg border border-border bg-muted/30 motion-reduce:animate-none ${className}`} />;
}

export function QuickActions() {
	const items = [
		{ href: "/clubs", icon: FiSearch, title: "Browse clubs", body: "Search 450+ UCI clubs by name or category." },
		{ href: "/events", icon: FiCalendar, title: "Campus calendar", body: "Every event scraped from club posts this week." },
		{ href: "/resources", icon: FiCompass, title: "Campus resources", body: "Basic needs, counseling and other UCI services." },
	];
	return (
		<div className="grid gap-2 sm:grid-cols-3">
			{items.map(({ href, icon: I, title, body }) => (
				<Link key={title} href={href} className="group rounded-lg border border-border p-3 hover:border-primary/60">
					<div className="flex items-center gap-2 text-sm font-medium text-foreground">
						<I className="h-4 w-4 text-primary" aria-hidden /> {title}
						<FiArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" aria-hidden />
					</div>
					<p className="mt-1 text-xs text-muted-foreground">{body}</p>
				</Link>
			))}
		</div>
	);
}

/** New user, no stars yet: say what the page will do, then give them clubs to star. */
export function EmptyDashboard({ suggested }) {
	return (
		<div className="space-y-8">
			<div className="rounded-lg border border-border p-4 sm:p-5">
				<div className="flex items-start gap-3">
					<span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-primary">
						<FiStar className="h-4 w-4" aria-hidden />
					</span>
					<div>
						<h2 className="text-sm font-semibold text-foreground">Star a few clubs to fill this page</h2>
						<p className="mt-1 max-w-xl text-sm text-muted-foreground">
							Your dashboard shows upcoming events and new posts from the clubs you star, plus an .ics you can add to your calendar.
						</p>
					</div>
				</div>
			</div>
			<QuickActions />
			<section>
				<SectionHeader title="Clubs to explore" href="/clubs" action="Browse all" />
				{suggested ? <ClubsGrid clubs={suggested} /> : <Skeleton className="h-56" />}
			</section>
		</div>
	);
}

export function timeLabel(ev) {
	return ev.allDay ? "All day" : timeRange(ev);
}
