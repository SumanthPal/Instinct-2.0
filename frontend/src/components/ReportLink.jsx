"use client";

import { useEffect, useState } from "react";
import ReportDialog, { describe, reportPageUrl } from "@/components/ReportDialog";
import { reportMailto } from "@/lib/report";

/**
 * Quiet "Something wrong? Let us know" link that opens the report form.
 * Pass `club` ({ id, name, handle }) on a club page, or `event` (a normalized
 * event) in event details. No sign-in needed. The href stays a prefilled
 * mailto: so the link still works before hydration or without JS.
 */
export default function ReportLink({ club, event, className = "" }) {
	const [open, setOpen] = useState(false);
	const [href, setHref] = useState(() => reportMailto({ subject: describe({ club, event }).subject }));
	useEffect(() => {
		const about = describe({ club, event });
		setHref(reportMailto({ subject: about.subject, url: reportPageUrl({ club, event }), context: about.context }));
	}, [club, event]);
	return (
		<>
			<a
				href={href}
				onClick={(e) => {
					if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
					e.preventDefault();
					setOpen(true);
				}}
				aria-haspopup="dialog"
				className={`text-xs text-muted-foreground/80 underline decoration-border underline-offset-4 hover:text-[var(--accent-brand)] hover:decoration-[var(--accent-brand)] ${className}`}
			>
				Something wrong? Let us know
			</a>
			{open && <ReportDialog open={open} onOpenChange={setOpen} club={club} event={event} />}
		</>
	);
}
