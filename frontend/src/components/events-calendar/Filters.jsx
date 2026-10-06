"use client";

import { useMemo, useState } from "react";
import { Command } from "cmdk";
import { FiCheck, FiSearch, FiX } from "react-icons/fi";
import ClubAvatar from "@/components/ClubAvatar";
import { TIMES, toneOf } from "./calendar-utils";

const label = "mb-2 pl-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground";

/** "For you" (starred clubs) | "All campus". */
export function ModeToggle({ mode, setMode, className = "" }) {
	const opts = [
		{ id: "foryou", label: "For you" },
		{ id: "all", label: "All campus" },
	];
	return (
		<div className={`inline-flex h-8 items-center rounded-full border border-border bg-background p-[3px] ${className}`}>
			{opts.map((o) => (
				<button
					key={o.id}
					type="button"
					aria-pressed={mode === o.id}
					onClick={() => setMode(o.id)}
					className={`h-full flex-1 whitespace-nowrap rounded-full px-3 text-xs font-medium transition-colors ${
						mode === o.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
					}`}
				>
					{o.label}
				</button>
			))}
		</div>
	);
}

function rank(club, q) {
	const n = club.name.toLowerCase();
	const h = club.instagram_handle;
	if (n.startsWith(q) || h.startsWith(q)) return 0;
	if (n.includes(` ${q}`)) return 1;
	if (n.includes(q) || h.includes(q)) return 2;
	return -1;
}

export const MAX_PICKS = 100; // GET /events takes at most 100 handles

function ClubAvatarRing({ club, size = 26 }) {
	return (
		<span className="instinct-story-ring shrink-0" style={{ padding: 1.5 }}>
			<span className="instinct-story-ring-inner" style={{ padding: 1 }}>
				<span className="relative block overflow-hidden rounded-full" style={{ width: size, height: size }}>
					<ClubAvatar src={club.profile_image_path || club.avatar || null} alt="" sizes={`${size}px`} ring={false} />
				</span>
			</span>
		</span>
	);
}

/**
 * Search-as-you-type over every club (cmdk combobox), matching name and
 * handle. Empty query shows the busiest clubs in view. Picks are
 * multi-select chips; they become the `clubs=` param of GET /events.
 */
export function ClubPicker({ clubs, busy, picks, onToggle, onRemove, onClear }) {
	const [q, setQ] = useState("");
	const [open, setOpen] = useState(false);
	const picked = new Set(picks.map((p) => p.handle));
	const query = q.trim().toLowerCase().replace(/^@/, "");
	const full = picks.length >= MAX_PICKS;
	const matches = useMemo(() => {
		if (!query) return busy.slice(0, 8);
		const out = [];
		for (const c of clubs) {
			const r = rank(c, query);
			if (r >= 0) out.push([r, c]);
		}
		out.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name));
		return out.slice(0, 40).map(([, c]) => c);
	}, [clubs, busy, query]);

	return (
		<div>
			{picks.length > 0 && (
				<div className="mb-2 flex flex-wrap items-center gap-1.5">
					{picks.map((p) => (
						<span key={p.handle} className="inline-flex h-7 min-w-0 max-w-full items-center gap-1.5 rounded-full border border-foreground/30 bg-muted pl-1 pr-0.5 text-xs text-foreground">
							<span className="relative block h-5 w-5 shrink-0 overflow-hidden rounded-full">
								<ClubAvatar src={p.avatar} alt="" sizes="20px" />
							</span>
							<span className="min-w-0 truncate">{p.name}</span>
							<button
								type="button"
								onClick={() => onRemove(p.handle)}
								aria-label={`Remove ${p.name}`}
								className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
							>
								<FiX className="h-3 w-3" />
							</button>
						</span>
					))}
					<button type="button" onClick={onClear} className="h-7 rounded-full px-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
						Clear
					</button>
				</div>
			)}
			<Command shouldFilter={false} loop label="Filter by club" className="relative">
				<div className="flex h-9 items-center gap-2 rounded-full border border-border bg-background px-3 focus-within:border-foreground/40">
					<FiSearch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
					<Command.Input
						value={q}
						onValueChange={(v) => {
							setQ(v);
							setOpen(true);
						}}
						onFocus={() => setOpen(true)}
						onBlur={() => setOpen(false)}
						onKeyDown={(e) => {
							if (e.key === "Escape") setOpen(false);
							else if (e.key === "Backspace" && !q && picks.length) onRemove(picks[picks.length - 1].handle);
							else if (!open) setOpen(true);
						}}
						placeholder={clubs.length > 20 ? `Search ${clubs.length} clubs` : "Search clubs"}
						className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
					/>
				</div>
				{open && (
					<Command.List className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto overscroll-contain rounded-md border border-border bg-popover p-1 shadow-sm">
						{!query && matches.length > 0 && <p className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-muted-foreground">Busiest in view</p>}
						<Command.Empty className="px-2 py-3 text-xs text-muted-foreground">No clubs match “{q.trim()}”</Command.Empty>
						{matches.map((c) => {
							const on = picked.has(c.instagram_handle);
							return (
								<Command.Item
									key={c.instagram_handle}
									value={c.instagram_handle}
									disabled={full && !on}
									onMouseDown={(e) => e.preventDefault()}
									onSelect={() => {
										onToggle({ handle: c.instagram_handle, name: c.name, avatar: c.profile_image_path || null });
										setQ("");
									}}
									className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 data-[disabled=true]:opacity-50 data-[selected=true]:bg-muted"
								>
									<ClubAvatarRing club={c} />
									<span className="min-w-0 flex-1">
										<span className="block truncate text-[13px] text-foreground">{c.name}</span>
										<span className="block truncate text-[11px] text-muted-foreground">@{c.instagram_handle}</span>
									</span>
									{on && <FiCheck className="h-3.5 w-3.5 shrink-0 text-foreground" aria-label="Selected" />}
								</Command.Item>
							);
						})}
						{full && <p className="px-2 py-1.5 text-[11px] text-muted-foreground">Up to {MAX_PICKS} clubs at a time.</p>}
					</Command.List>
				)}
			</Command>
		</div>
	);
}

/** The prominent "Clubs" block: label + picker + chips. */
export function ClubSection(props) {
	return (
		<section>
			<p className={label}>
				Clubs{props.picks.length > 0 && <span className="ml-1 normal-case tracking-normal text-foreground">· {props.picks.length}</span>}
			</p>
			<ClubPicker {...props} />
		</section>
	);
}

const chip = (on) =>
	`inline-flex h-7 max-w-full shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors ${
		on ? "border-foreground/50 bg-muted text-foreground" : "border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground"
	}`;

/** Real club category names, busiest first; colour dot = calendar tone. */
export function CategoryFilter({ counts, selected, toggle }) {
	const [all, setAll] = useState(false);
	const LIMIT = 8;
	// Keep selected names visible even when they fall outside the top 8.
	const shown = all ? counts : counts.filter(([n], i) => i < LIMIT || selected.has(n));
	return (
		<div className="flex flex-wrap gap-1.5">
			{shown.map(([name, n]) => {
				const on = selected.has(name);
				return (
					<button key={name} type="button" aria-pressed={on} onClick={() => toggle(name)} className={`cal-cat-${toneOf(name)} ${chip(on)}`}>
						<span className="cal-dot h-2 w-2 shrink-0 rounded-full" />
						<span className="min-w-0 truncate">{name}</span>
						<span className="tabular-nums text-muted-foreground">{n}</span>
					</button>
				);
			})}
			{counts.length > LIMIT && (
				<button type="button" onClick={() => setAll((a) => !a)} className="h-7 rounded-full px-2 text-xs font-medium text-muted-foreground hover:text-foreground">
					{all ? "Fewer" : `+${counts.length - shown.length} more`}
				</button>
			)}
			{counts.length === 0 && <p className="pl-1 text-xs text-muted-foreground">No categories in view.</p>}
		</div>
	);
}

export function TimeFilter({ times, toggle }) {
	return (
		<div className="flex flex-wrap gap-1.5">
			{TIMES.map((t) => (
				<button key={t.id} type="button" aria-pressed={times.has(t.id)} onClick={() => toggle(t.id)} title={t.hint} className={chip(times.has(t.id))}>
					{t.label}
				</button>
			))}
		</div>
	);
}

/** Categories and time of day; the sidebar (lg+) and the filters sheet. */
export function FilterPanel({ counts, cats, toggleCat, times, toggleTime, activeCount, onClear }) {
	return (
		<div className="space-y-5">
			<section>
				<div className="flex items-center justify-between">
					<p className={label}>Categories</p>
					{activeCount > 0 && (
						<button type="button" onClick={onClear} className="-mt-2 text-[11px] font-medium text-muted-foreground hover:text-foreground">
							Reset
						</button>
					)}
				</div>
				<CategoryFilter counts={counts} selected={cats} toggle={toggleCat} />
			</section>
			<section>
				<p className={label}>Time of day</p>
				<TimeFilter times={times} toggle={toggleTime} />
			</section>
		</div>
	);
}
