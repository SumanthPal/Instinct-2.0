"use client";

import { format } from "date-fns";
import { useEffect, useState } from "react";
import { reportMailto } from "@/lib/report";

/**
 * Quiet "Something wrong? Let us know" link that opens a prefilled email.
 * Pass `club` (handle) for a club page, or `event` (a normalized event) for an event.
 * The page URL needs the live origin, so the full href is filled in after mount
 * (and rebuilt on click); no sign-in needed.
 */
export default function ReportLink({ club, event, className = "" }) {
	const build = () => {
		const origin = window.location.origin;
		if (event) {
			const day = format(event.start, "yyyy-MM-dd");
			const handle = event.club?.handle;
			const q = new URLSearchParams({ ...(handle ? { club: handle } : {}), date: day, view: "day" });
			return reportMailto({
				subject: `Instinct correction: ${event.title} (${format(event.start, "MMM d, yyyy")})`,
				url: `${origin}/events?${q}`,
				context: [handle && `Club: @${handle}`, `Event: ${event.title}`, `When: ${format(event.start, event.allDay ? "EEE MMM d, yyyy '(all day)'" : "EEE MMM d, yyyy h:mm a")}`],
			});
		}
		return reportMailto({ subject: `Instinct correction: @${club}`, url: `${origin}/club/${club}` });
	};
	const [href, setHref] = useState(() =>
		reportMailto({ subject: `Instinct correction: ${club ? `@${club}` : event?.title || ""}` }),
	);
	// biome-ignore lint/correctness/useExhaustiveDependencies: build() only reads club/event
	useEffect(() => setHref(build()), [club, event]);
	return (
		<a
			href={href}
			onClick={(e) => {
				e.currentTarget.href = build();
			}}
			className={`text-xs text-muted-foreground/80 underline decoration-border underline-offset-4 hover:text-[var(--accent-brand)] hover:decoration-[var(--accent-brand)] ${className}`}
		>
			Something wrong? Let us know
		</a>
	);
}
