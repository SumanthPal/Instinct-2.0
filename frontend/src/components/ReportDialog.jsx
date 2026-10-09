"use client";

import { useEffect, useId, useState } from "react";
import { format } from "date-fns";
import { FiCheck, FiX } from "react-icons/fi";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { REPORT_CATEGORIES, REPORT_NOTE_MAX, reportMailto, submitReport } from "@/lib/report";
import { cn } from "@/lib/utils";

const PHONE = "(max-width: 639px)";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

/** Page link sent with the report: the club page, or that day in the calendar filtered to the club. */
export function reportPageUrl({ club, event }) {
	const origin = window.location.origin;
	if (event) {
		const handle = event.club?.handle;
		const q = new URLSearchParams({ ...(handle ? { club: handle } : {}), date: format(event.start, "yyyy-MM-dd"), view: "day" });
		return `${origin}/events?${q}`;
	}
	if (club?.handle) return `${origin}/club/${club.handle}`;
	return window.location.href;
}

export const SITE_REPORT_SUBJECT = "Instinct: problem report";

/**
 * What the report is about: one line for the header, plus mailto context.
 * Neither `club` nor `event` means the footer's site-wide report: kind "site",
 * no club_id or event_id (backend #150).
 */
export function describe({ club, event }) {
	if (!club && !event) {
		const path = typeof window !== "undefined" ? window.location.pathname : "";
		return {
			kind: "site",
			label: "Page",
			primary: "Instinct",
			secondary: path,
			subject: SITE_REPORT_SUBJECT,
			context: [],
			ids: {},
		};
	}
	if (event) {
		const when = format(event.start, event.allDay ? "EEE, MMM d" : "EEE, MMM d · h:mm a");
		const handle = event.club?.handle;
		return {
			kind: "event",
			label: "Event",
			primary: event.title,
			secondary: [event.club?.name || (handle && `@${handle}`), when].filter(Boolean).join(" · "),
			subject: `Instinct correction: ${event.title} (${format(event.start, "MMM d, yyyy")})`,
			context: [handle && `Club: @${handle}`, `Event: ${event.title}`, `When: ${when}`],
			ids: { club_id: event.club?.id ?? event.clubId ?? null, event_id: event.id },
		};
	}
	return {
		kind: "club",
		label: "Club",
		primary: club?.name || `@${club?.handle}`,
		secondary: club?.handle ? `@${club.handle}` : "",
		subject: `Instinct correction: @${club?.handle}`,
		context: [club?.handle && `Club: @${club.handle}`],
		ids: { club_id: club?.id ?? null },
	};
}

const fieldCls =
	"w-full rounded-md border border-input bg-transparent px-3 text-base sm:text-sm placeholder:text-muted-foreground/70 focus-visible:border-[var(--accent-brand)] focus-visible:outline-none";

function ReportForm({ subject: about, pageUrl, onDone }) {
	const ids = useId();
	const [category, setCategory] = useState(null);
	const [note, setNote] = useState("");
	const [email, setEmail] = useState("");
	const [status, setStatus] = useState("idle"); // idle | sending | sent | failed | rate_limited
	const [touched, setTouched] = useState(false);

	const cat = REPORT_CATEGORIES.find((c) => c.id === category);
	const noteErr = touched && !note.trim() ? "Add a short note so we know what to fix." : null;
	const catErr = touched && !category ? "Pick one." : null;
	const emailErr = email && !EMAIL_RE.test(email.trim()) ? "That doesn't look like an email." : null;

	const mailto = () =>
		reportMailto({
			subject: about.subject,
			url: pageUrl,
			context: [...about.context, cat && `Category: ${cat.label}`],
			note: note.trim(),
		});

	const submit = async (e) => {
		e.preventDefault();
		setTouched(true);
		if (!category || !note.trim() || emailErr) return;
		setStatus("sending");
		try {
			await submitReport({
				kind: about.kind,
				...about.ids,
				page_url: pageUrl,
				category,
				note: note.trim(),
				...(email.trim() ? { email: email.trim() } : {}),
			});
			setStatus("sent");
		} catch (err) {
			setStatus(err?.kind === "rate_limited" ? "rate_limited" : "failed");
		}
	};

	if (status === "sent") {
		return (
			<div className="flex flex-col items-center px-5 pb-6 pt-8 text-center" role="status">
				<span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--accent-brand)] text-[var(--accent-brand)]">
					<FiCheck className="h-4 w-4" aria-hidden />
				</span>
				<p className="mt-3 text-sm font-semibold">Thanks, we&apos;ll take a look.</p>
				<p className="mt-1 max-w-xs text-xs text-muted-foreground">
					{email.trim() ? `We'll reply to ${email.trim()} if we need more detail.` : "Fixes usually show up within a day."}
				</p>
				<button type="button" onClick={onDone} className="mt-5 h-8 rounded-md border border-border px-4 text-xs font-medium hover:bg-accent">
					Done
				</button>
			</div>
		);
	}

	const sending = status === "sending";
	return (
		<form onSubmit={submit} noValidate className="flex flex-col gap-4 px-5 pb-5 pt-3">
			<fieldset>
				<legend className="mb-2 text-xs font-medium">What&apos;s wrong?</legend>
				<div role="radiogroup" aria-invalid={!!catErr} className="flex flex-wrap gap-1.5">
					{REPORT_CATEGORIES.filter((c) => !c.only || c.only.includes(about.kind)).map((c) => {
						const on = category === c.id;
						return (
							<label
								key={c.id}
								className={cn(
									"instinct-chip inline-flex h-8 cursor-pointer items-center rounded-md border px-2.5 text-xs transition-colors has-[:focus-visible]:border-[var(--accent-brand)]",
									on && "instinct-chip-active",
								)}
							>
								<input type="radio" name={`${ids}-cat`} value={c.id} checked={on} onChange={() => setCategory(c.id)} className="sr-only" />
								{c.label}
							</label>
						);
					})}
				</div>
				{catErr && <p className="mt-1.5 text-xs text-destructive">{catErr}</p>}
			</fieldset>

			<div>
				<div className="mb-1.5 flex items-baseline justify-between">
					<label htmlFor={`${ids}-note`} className="text-xs font-medium">
						Note
					</label>
					<span className={cn("text-[11px] tabular-nums text-muted-foreground", note.length >= REPORT_NOTE_MAX && "text-destructive")}>
						{note.length}/{REPORT_NOTE_MAX}
					</span>
				</div>
				<textarea
					id={`${ids}-note`}
					value={note}
					onChange={(e) => setNote(e.target.value.slice(0, REPORT_NOTE_MAX))}
					maxLength={REPORT_NOTE_MAX}
					rows={4}
					required
					aria-invalid={!!noteErr}
					placeholder={cat?.hint || "Tell us what you noticed."}
					className={cn(fieldCls, "min-h-24 resize-y py-2 leading-snug", noteErr && "border-destructive")}
				/>
				{noteErr && <p className="mt-1.5 text-xs text-destructive">{noteErr}</p>}
			</div>

			<div>
				<label htmlFor={`${ids}-email`} className="mb-1.5 block text-xs font-medium">
					Email <span className="font-normal text-muted-foreground">(optional, if you&apos;d like a reply)</span>
				</label>
				<input
					id={`${ids}-email`}
					type="email"
					inputMode="email"
					autoComplete="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					placeholder="you@uci.edu"
					aria-invalid={!!emailErr}
					className={cn(fieldCls, "h-9", emailErr && "border-destructive")}
				/>
				{emailErr && <p className="mt-1.5 text-xs text-destructive">{emailErr}</p>}
			</div>

			{(status === "failed" || status === "rate_limited") && (
				<div role="alert" className="rounded-md border border-destructive/50 px-3 py-2.5 text-xs leading-relaxed">
					<p className="font-medium text-destructive">
						{status === "rate_limited" ? "Too many reports from you right now." : "Couldn't send your report."}
					</p>
					<p className="mt-0.5 text-muted-foreground">
						{status === "rate_limited" ? "Try again in a few minutes, or " : "Try again, or "}
						<a href={mailto()} className="text-foreground underline underline-offset-4 hover:text-[var(--accent-brand)]">
							email it to us
						</a>{" "}
						with your note filled in.
					</p>
				</div>
			)}

			<div className="flex items-center justify-between gap-3 border-t border-border pt-4">
				<a
					href={mailto()}
					onClick={(e) => {
						e.currentTarget.href = mailto();
					}}
					className="text-xs text-muted-foreground underline decoration-border underline-offset-4 hover:text-[var(--accent-brand)] hover:decoration-[var(--accent-brand)]"
				>
					or email us instead
				</a>
				<button type="submit" disabled={sending} className="instinct-btn h-9 rounded-md px-4 text-sm font-medium disabled:opacity-60">
					{sending ? "Sending…" : status === "failed" ? "Try again" : "Send report"}
				</button>
			</div>
		</form>
	);
}

function Header({ about, Title, Description }) {
	return (
		<div className="px-5 pt-4">
			<div className="flex items-start justify-between gap-3">
				<Title className="text-sm font-semibold">Report a problem</Title>
				<DialogClose className="-mr-1.5 -mt-0.5 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close">
					<FiX className="h-4 w-4" aria-hidden />
				</DialogClose>
			</div>
			<Description asChild>
				<div className="mt-3 flex min-w-0 items-baseline gap-2 rounded-md border border-border px-3 py-2 text-xs">
					<span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-[var(--accent-brand)]">{about.label}</span>
					<span className="min-w-0 truncate">
						<span className="font-medium text-foreground">{about.primary}</span>
						{about.secondary && <span className="text-muted-foreground"> · {about.secondary}</span>}
					</span>
				</div>
			</Description>
		</div>
	);
}

/** Report form: a dialog on desktop, a bottom sheet on phones. */
export default function ReportDialog({ open, onOpenChange, club, event }) {
	const phone = useIsPhone();
	const about = describe({ club, event });
	const pageUrl = reportPageUrl({ club, event });
	const close = () => onOpenChange(false);
	if (phone) {
		return (
			<Sheet open={open} onOpenChange={onOpenChange}>
				<SheetContent aria-label="Report a problem">
					<Header about={about} Title={SheetTitle} Description={SheetDescription} />
					<ReportForm subject={about} pageUrl={pageUrl} onDone={close} />
				</SheetContent>
			</Sheet>
		);
	}
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-[460px]">
				<Header about={about} Title={DialogTitle} Description={DialogDescription} />
				<ReportForm subject={about} pageUrl={pageUrl} onDone={close} />
			</DialogContent>
		</Dialog>
	);
}
