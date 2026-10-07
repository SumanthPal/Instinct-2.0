"use client";

import { addDays, format, isSameDay, startOfDay } from "date-fns";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FiCalendar, FiExternalLink, FiPlus } from "react-icons/fi";
import {
	AddToCal,
	Avatar,
	ClubsGrid,
	EmptyDashboard,
	EventRow,
	GroupedEvents,
	PostGrid,
	SectionHeader,
	Skeleton,
	dayLabel,
	timeLabel,
} from "./parts";

function Header({ name, clubs, events }) {
	const week = events?.filter((e) => e.start < addDays(startOfDay(new Date()), 7)).length;
	return (
		<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight text-foreground">{name ? `Hi, ${name}` : "Dashboard"}</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					{clubs.length ? (
						<>
							{clubs.length} starred clubs · <span className="text-foreground">{week ?? "…"}</span> events this week
						</>
					) : (
						"You haven't starred any clubs yet."
					)}
				</p>
			</div>
			{clubs.length > 0 && (
				<div className="flex gap-2">
					<Link href="/events" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs text-foreground hover:border-primary/60">
						<FiCalendar className="h-3.5 w-3.5" aria-hidden /> Full calendar
					</Link>
					<Link href="/clubs" className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90">
						<FiPlus className="h-3.5 w-3.5" aria-hidden /> Find clubs
					</Link>
				</div>
			)}
		</div>
	);
}

function NextUp({ ev }) {
	const [ok, setOk] = useState(Boolean(ev.postImage));
	return (
		<div className="grid overflow-hidden rounded-lg border border-border sm:grid-cols-[180px_minmax(0,1fr)]">
			<div className="relative hidden aspect-square border-r border-border bg-muted/30 sm:block">
				{ok ? (
					// biome-ignore lint/performance/noImgElement: poster, date tile on error
					<img src={ev.postImage} alt="" onError={() => setOk(false)} className="h-full w-full object-cover" />
				) : (
					<div className="flex h-full flex-col items-center justify-center">
						<div className="text-xs uppercase text-primary">{format(ev.start, "MMM")}</div>
						<div className="text-4xl font-semibold tabular-nums">{format(ev.start, "d")}</div>
					</div>
				)}
			</div>
			<div className="flex min-w-0 flex-col p-4">
				<div className="text-[11px] font-medium uppercase tracking-wide text-primary">Next up · {dayLabel(ev.start)}</div>
				<Link href={`/club/${ev.club?.handle}?tab=events`} className="mt-1 line-clamp-2 text-lg font-semibold tracking-tight hover:text-primary">
					{ev.title}
				</Link>
				<div className="mt-1 text-sm text-muted-foreground">
					{timeLabel(ev)}
					{ev.location && ` · ${ev.location}`}
				</div>
				<div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
					<Avatar src={ev.avatar} size={16} /> {ev.club?.name}
				</div>
				<div className="mt-auto flex flex-wrap gap-2 pt-4">
					<AddToCal ev={ev} label />
					{ev.postId && (
						<Link href={`/club/${ev.club?.handle}?post=${ev.postId}`} className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-xs text-muted-foreground hover:text-foreground">
							<FiExternalLink className="h-3.5 w-3.5" aria-hidden /> View post
						</Link>
					)}
				</div>
			</div>
		</div>
	);
}

function WeekStrip({ events, now }) {
	const [sel, setSel] = useState(0);
	const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(startOfDay(now), i)), [now]);
	const per = useMemo(() => days.map((d) => (events || []).filter((e) => isSameDay(e.start, d))), [days, events]);
	return (
		<div className="overflow-hidden rounded-lg border border-border">
			<div className="grid grid-cols-7 border-b border-border">
				{days.map((d, i) => (
					<button
						key={d.toISOString()}
						type="button"
						onClick={() => setSel(i)}
						aria-pressed={sel === i}
						className={`border-r border-border px-1 py-2 text-center last:border-r-0 ${sel === i ? "bg-primary/10" : "hover:bg-muted/40"}`}
					>
						<div className={`text-[11px] uppercase ${sel === i ? "text-primary" : "text-muted-foreground"}`}>{i === 0 ? "Today" : format(d, "EEE")}</div>
						<div className="text-base font-semibold tabular-nums">{format(d, "d")}</div>
						<div className="mt-1 flex h-1.5 justify-center gap-0.5">
							{per[i].slice(0, 4).map((e) => (
								<span key={e.id} className="h-1.5 w-1.5 rounded-full bg-primary" />
							))}
						</div>
					</button>
				))}
			</div>
			{per[sel].length ? (
				<ul className="divide-y divide-border">
					{per[sel].map((ev) => (
						<EventRow key={ev.id} ev={ev} />
					))}
				</ul>
			) : (
				<div className="px-3 py-6 text-sm text-muted-foreground">Nothing from your clubs on {dayLabel(days[sel])}.</div>
			)}
		</div>
	);
}

const TABS = ["Overview", "Events", "Posts", "Clubs"];

/** Signed-in dashboard: next-up card + 7-day strip on Overview; events, posts and clubs get their own tabs. */
export default function DashboardTabs({ name, clubs, data, now, onUnstar }) {
	const { events, posts, suggested, topCategory } = data;
	const [tab, setTab] = useState("Overview");
	if (!clubs.length)
		return (
			<>
				<Header name={name} clubs={clubs} events={events} />
				<EmptyDashboard suggested={suggested} />
			</>
		);
	const next = events?.find((e) => e.start >= now) || events?.[0];
	const counts = { Events: events?.length, Posts: posts?.length, Clubs: clubs.length };
	return (
		<>
			<Header name={name} clubs={clubs} events={events} />
			<div className="mb-6 flex gap-5 overflow-x-auto border-b border-border" role="tablist">
				{TABS.map((t) => (
					<button
						key={t}
						type="button"
						role="tab"
						aria-selected={tab === t}
						onClick={() => setTab(t)}
						className={`-mb-px shrink-0 border-b-2 pb-2 text-sm ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
					>
						{t}
						{counts[t] != null && <span className="ml-1.5 text-xs text-muted-foreground">{counts[t]}</span>}
					</button>
				))}
			</div>
			{tab === "Overview" && (
				<div className="space-y-8">
					{events ? next ? <NextUp ev={next} /> : null : <Skeleton className="h-44" />}
					<section>
						<SectionHeader title="This week" />
						{events ? <WeekStrip events={events} now={now} /> : <Skeleton className="h-56" />}
					</section>
					<section>
						<SectionHeader title="New posts" />
						{posts ? <PostGrid posts={posts} cols="grid-cols-3 sm:grid-cols-6" limit={6} /> : <Skeleton className="h-28" />}
					</section>
				</div>
			)}
			{tab === "Events" && (events ? <GroupedEvents events={events} cap={50} /> : <Skeleton className="h-80" />)}
			{tab === "Posts" && (posts ? <PostGrid posts={posts} cols="grid-cols-2 sm:grid-cols-4" limit={12} /> : <Skeleton className="h-80" />)}
			{tab === "Clubs" && (
				<div className="space-y-10">
					<ClubsGrid clubs={clubs} onUnstar={onUnstar} />
					{suggested?.length > 0 && (
						<section>
							<SectionHeader title={`More in ${topCategory || "your categories"}`} href="/clubs" action="Browse" />
							<ClubsGrid clubs={suggested.slice(0, 3)} />
						</section>
					)}
				</div>
			)}
		</>
	);
}
